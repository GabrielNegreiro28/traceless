import { InferenceSource, type HybridParams } from 'firebase/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSystemPrompt as verifierSystemPrompt } from '../ai/prompts/disclosureVerify.v1';
import { buildSystemPrompt as investigatorSystemPrompt } from '../ai/prompts/identityScan.v3-investigator';
import { SHIPPED_SCAN_PIPELINE, v3Pipeline } from '../ai/prompts/scanPipelines';
import { MODEL_FINDING_CATEGORIES } from '../ai/schemas/identityScan';
import { toRawText } from '../domain/text/brandedText';
import { createVariantServices } from './compositionRoot';
import type { AppEnv } from './env';

/**
 * Real-mode wiring of the round-3 pipelines with the SDK boundary mocked (no network): the
 * investigator and verifier models are ONLY_ON_DEVICE models on the shared queue.
 */
const sdk = vi.hoisted(() => ({
  getAI: vi.fn(),
  getGenerativeModel: vi.fn(),
  bootstrapFirebase: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock('firebase/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAI: sdk.getAI,
  getGenerativeModel: sdk.getGenerativeModel,
}));
vi.mock('./firebaseBootstrap', () => ({ bootstrapFirebase: sdk.bootstrapFirebase }));

const REAL_ENV: AppEnv = {
  firebase: {
    apiKey: 'test-api-key',
    authDomain: 'demo-traceless.firebaseapp.com',
    projectId: 'demo-traceless',
    storageBucket: 'demo-traceless.appspot.com',
    messagingSenderId: '0',
    appId: '1:0:web:0',
  },
  recaptchaSiteKey: 'test-site-key',
  aiMode: 'real',
  useEmulators: false,
};

const REPORT = toRawText(
  'I restock the vending machines on our night rotation. The treasurer keeps the coins.',
);
const NO_FINDINGS = JSON.stringify({ findings: [] });
const VERDICTS = JSON.stringify({ items: [{ id: 1, about: 'WRITER', category: 'SCHEDULE' }] });

function systemPromptOf(call: number): string {
  return systemPromptIn(sdk.getGenerativeModel.mock.calls[call]?.[1] as HybridParams | undefined);
}

function systemPromptIn(params: HybridParams | undefined): string {
  const first = params?.onDeviceParams?.createOptions?.initialPrompts?.[0]?.content;
  const part = Array.isArray(first) ? first[0] : undefined;
  return part !== undefined && 'value' in part && typeof part.value === 'string' ? part.value : '';
}

/** Like Chrome: aborting the create() signal destroys the session and rejects the prompt. */
function hangUntilAborted(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('destroyed', 'AbortError')));
  });
}

/** The abort signal of the first created model with this system prompt. */
function signalOfModel(systemPrompt: string): AbortSignal | undefined {
  const call = sdk.getGenerativeModel.mock.calls.find(
    ([, params]) => systemPromptIn(params as HybridParams) === systemPrompt,
  );
  return (call?.[1] as HybridParams | undefined)?.onDeviceParams?.createOptions?.signal;
}

describe('round-3 pipelines (real AI mode, SDK mocked)', () => {
  beforeEach(() => {
    sdk.bootstrapFirebase.mockImplementation(() => ({ name: 'app' }));
    sdk.getAI.mockImplementation(() => ({ id: Symbol('ai') }));
    sdk.getGenerativeModel.mockImplementation(() => ({
      generateContent: sdk.generateContent,
      initializeDeviceModel: vi.fn(),
    }));
    sdk.generateContent.mockImplementation((prompt: string) =>
      Promise.resolve({
        response: {
          inferenceSource: InferenceSource.ON_DEVICE,
          text: () => (prompt.includes('\nPhrases:\n') ? VERDICTS : NO_FINDINGS),
        },
      }),
    );
    vi.stubGlobal('LanguageModel', { availability: () => Promise.resolve('available') });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('base+verifier+investigator: v2, investigator, then the verifier, all on the device', async () => {
    const services = createVariantServices(REAL_ENV)(v3Pipeline({ base: true, verify: true }));
    const result = await services.scanReport(REPORT);
    if (!result.ok) throw new Error(result.error.kind);
    expect(sdk.generateContent).toHaveBeenCalledTimes(3);
    const prompts = sdk.generateContent.mock.calls.map(([p]) => String(p));
    expect(prompts.map((p) => p.includes('\nPhrases:\n'))).toEqual([false, false, true]);
    expect(systemPromptOf(1)).toBe(investigatorSystemPrompt(MODEL_FINDING_CATEGORIES));
    expect(systemPromptOf(2)).toBe(verifierSystemPrompt());
    for (const [, params, options] of sdk.getGenerativeModel.mock.calls as [
      unknown,
      HybridParams,
      unknown,
    ][]) {
      expect(params.mode).toBe('only_on_device');
      expect(options).toEqual({ baseUrl: 'https://on-device-only.invalid' });
    }
    expect(result.value.modelFindings.every((f) => f.category === 'SCHEDULE')).toBe(true);
    expect(result.value.modelFindings).toHaveLength(1);
  });

  it('base+investigator never calls the verifier', async () => {
    const services = createVariantServices(REAL_ENV)(v3Pipeline({ base: true, verify: false }));
    const result = await services.scanReport(REPORT);
    expect(result.ok).toBe(true);
    expect(sdk.generateContent).toHaveBeenCalledTimes(2);
    const prompts = sdk.generateContent.mock.calls.map(([p]) => String(p));
    expect(prompts.some((p) => p.includes('\nPhrases:\n'))).toBe(false);
  });

  it('verifier+investigator: the investigator pass, then the verifier', async () => {
    const services = createVariantServices(REAL_ENV)(v3Pipeline({ base: false, verify: true }));
    const result = await services.scanReport(REPORT);
    expect(result.ok).toBe(true);
    expect(sdk.generateContent).toHaveBeenCalledTimes(2);
    expect(systemPromptOf(0)).toBe(investigatorSystemPrompt(MODEL_FINDING_CATEGORIES));
  });

  it('without window.LanguageModel a verify pipeline calls no model and fails OnDeviceUnavailable', async () => {
    vi.unstubAllGlobals();
    expect('LanguageModel' in globalThis).toBe(false);
    const services = createVariantServices(REAL_ENV)(v3Pipeline({ base: false, verify: true }));
    const result = await services.scanReport(REPORT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('OnDeviceUnavailable');
    expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });
  it('the shipped pipeline records one on-device RAW scan entry, verifier calls included', async () => {
    const services = createVariantServices(REAL_ENV)(SHIPPED_SCAN_PIPELINE);
    const result = await services.scanReport(REPORT);
    expect(result.ok).toBe(true);
    expect(sdk.generateContent).toHaveBeenCalledTimes(2);
    expect(services.privacyLedger.entries()).toMatchObject([
      { task: 'identityScan', source: 'onDevice', dataClass: 'RAW', demo: false },
    ]);
  });

  it('a stalled verifier call abandons the verifier model; the retry runs on a fresh one', async () => {
    vi.useFakeTimers();
    try {
      let verifierModels = 0;
      sdk.getGenerativeModel.mockImplementation((_ai: unknown, params: HybridParams) => {
        const signal = params.onDeviceParams?.createOptions?.signal;
        const isVerifier = systemPromptIn(params) === verifierSystemPrompt();
        const hangs = isVerifier && ++verifierModels === 1;
        return {
          initializeDeviceModel: vi.fn(),
          generateContent: (prompt: string): Promise<unknown> =>
            hangs ? hangUntilAborted(signal) : (sdk.generateContent(prompt) as Promise<unknown>),
        };
      });
      const services = createVariantServices(REAL_ENV)(SHIPPED_SCAN_PIPELINE);
      const pending = services.scanReport(REPORT);
      await vi.advanceTimersByTimeAsync(120_000);
      const first = await pending;
      expect(!first.ok && first.error).toMatchObject({ kind: 'OnDeviceStuck', recoverable: true });
      expect(services.privacyLedger.entries()).toEqual([]);
      const verifierSignal = signalOfModel(verifierSystemPrompt());
      expect(verifierSignal?.aborted).toBe(true);

      const second = await services.scanReport(REPORT);
      expect(second.ok).toBe(true);
      expect(verifierModels).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
