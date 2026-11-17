import { InferenceSource, type HybridParams } from 'firebase/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISCLOSURE_VERIFY_V1 } from '../ai/prompts/disclosureVerify.v1';
import { getPromptModule } from '../ai/prompts/promptRegistry';
import { v2Pipeline } from '../ai/prompts/scanPipelines';
import { MODEL_FINDING_CATEGORIES } from '../ai/schemas/identityScan';
import { toRawText } from '../domain/text/brandedText';
import { createServices, createVariantServices } from './compositionRoot';
import type { AppEnv } from './env';

/**
 * Real-mode wiring with the SDK boundary mocked: proves the composition root assembles
 * the fail-closed layers end to end. No network: getAI/getGenerativeModel are fakes.
 */
const sdk = vi.hoisted(() => ({
  getAI: vi.fn(),
  getGenerativeModel: vi.fn(),
  bootstrapFirebase: vi.fn(),
  generateContent: vi.fn(),
  initializeDeviceModel: vi.fn(),
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
  'I am the only night nurse on ward 7. The head nurse falsifies the drug log.',
);
const MODEL_JSON = JSON.stringify({
  findings: [
    {
      quote: 'only night nurse',
      category: 'ROLE_UNIQUE',
      reason: 'Unique role.',
      suggestion: 'a nurse',
    },
  ],
});

const NO_VERDICTS = JSON.stringify({ items: [] });

/** The initialPrompts the factory put in the n-th created model's createOptions. */
function initialPromptsOf(call: number): unknown {
  const params = sdk.getGenerativeModel.mock.calls[call]?.[1] as HybridParams | undefined;
  return params?.onDeviceParams?.createOptions?.initialPrompts;
}

function respond(inferenceSource: InferenceSource, text = MODEL_JSON): void {
  sdk.generateContent.mockResolvedValue({ response: { inferenceSource, text: () => text } });
}

const V1 = {
  promptVersion: 'identityScan.v1',
  chunkChars: 3000,
  postFilters: [],
  rulePack: 'core',
} as const;

/** The abort signal the factory put in the n-th created model's createOptions. */
function signalOf(call: number): AbortSignal | undefined {
  const params = sdk.getGenerativeModel.mock.calls[call]?.[1] as HybridParams | undefined;
  return params?.onDeviceParams?.createOptions?.signal;
}

/** Like Chrome: aborting the create() signal destroys the session and rejects the prompt. */
function hangUntilAborted(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('destroyed', 'AbortError')));
  });
}

describe('createServices (real AI mode, SDK mocked)', () => {
  beforeEach(() => {
    sdk.bootstrapFirebase.mockImplementation(() => ({ name: 'app' }));
    sdk.getAI.mockImplementation(() => ({ id: Symbol('ai') }));
    sdk.getGenerativeModel.mockImplementation(() => ({
      generateContent: sdk.generateContent,
      initializeDeviceModel: sdk.initializeDeviceModel,
    }));
    sdk.initializeDeviceModel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('without the Prompt API: fails closed and never creates a model', async () => {
    const services = createServices(REAL_ENV);
    const result = await services.scanReport(REPORT);
    expect(!result.ok && result.error.kind).toBe('OnDeviceUnavailable');
    await expect(services.deviceCapability.check()).resolves.toBe('unavailable');
    const prepared = await services.deviceCapability.prepare(() => undefined);
    expect(!prepared.ok && prepared.error.kind).toBe('OnDeviceUnavailable');
    expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });

  describe('with the Prompt API available', () => {
    beforeEach(() => {
      vi.stubGlobal('LanguageModel', { availability: () => Promise.resolve('available') });
    });

    it('scans on the device with an ONLY_ON_DEVICE model behind a dead cloud endpoint', async () => {
      respond(InferenceSource.ON_DEVICE);
      const result = await createServices(REAL_ENV).scanReport(REPORT);
      if (!result.ok) throw new Error(result.error.kind);
      expect(result.value.source).toBe('ON_DEVICE');
      expect(result.value.findings.map((f) => [f.quote, f.origin])).toEqual([
        ['the only night nurse', 'RULE'],
      ]);
      expect(sdk.getGenerativeModel).toHaveBeenCalled();
      for (const [, params, requestOptions] of sdk.getGenerativeModel.mock.calls as [
        unknown,
        HybridParams,
        unknown,
      ][]) {
        expect(params.mode).toBe('only_on_device');
        expect(requestOptions).toEqual({ baseUrl: 'https://on-device-only.invalid' });
      }
    });

    it('ships v3-verifier+investigator by default: investigator, verifier, post-filters on', async () => {
      const outlet = { quote: 'The head nurse', category: 'REPORTED_PERSON', reason: 'r' };
      const scanJson = JSON.stringify({ findings: [{ ...outlet, suggestion: '' }] });
      sdk.generateContent.mockImplementation((prompt: string) =>
        Promise.resolve({
          response: {
            inferenceSource: InferenceSource.ON_DEVICE,
            text: () => (prompt.includes('\nPhrases:\n') ? NO_VERDICTS : scanJson),
          },
        }),
      );
      const result = await createServices(REAL_ENV).scanReport(REPORT);
      if (!result.ok) throw new Error(result.error.kind);
      expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(2);
      expect(sdk.generateContent).toHaveBeenCalledTimes(2);
      const investigator = getPromptModule('identityScan.v3-investigator');
      expect(initialPromptsOf(0)).toEqual(
        investigator?.buildInitialPrompts(MODEL_FINDING_CATEGORIES),
      );
      expect(initialPromptsOf(1)).toEqual(DISCLOSURE_VERIFY_V1.buildInitialPrompts());
      // Only the protectedMentions post-filter turns the outlet quote into a protected span.
      expect(result.value.protectedSpans).toEqual([{ start: 37, end: 51 }]);
    });

    it('discards an in-cloud answer as a privacy violation', async () => {
      respond(InferenceSource.IN_CLOUD);
      const result = await createServices(REAL_ENV).scanReport(REPORT);
      expect(!result.ok && result.error.kind).toBe('PrivacyViolation');
    });

    it('prepares every on-device task of the shipped pipeline inside one call', async () => {
      const progress: number[] = [];
      const finish: (() => void)[] = [];
      sdk.initializeDeviceModel.mockImplementation((onProgress?: (p: number) => void) => {
        onProgress?.(0.5);
        return new Promise<void>((resolve) => finish.push(resolve));
      });
      const pending = createServices(REAL_ENV).deviceCapability.prepare((p) => progress.push(p));
      await vi.waitFor(() => expect(sdk.initializeDeviceModel).toHaveBeenCalledTimes(2));
      // Both downloads started before either settled: still within the reporter's click.
      expect(progress).toEqual([0.25, 0.5]);
      finish.forEach((resolve) => resolve());
      expect((await pending).ok).toBe(true);
      expect(initialPromptsOf(0)).toEqual(
        getPromptModule('identityScan.v3-investigator')?.buildInitialPrompts(
          MODEL_FINDING_CATEGORIES,
        ),
      );
      expect(initialPromptsOf(1)).toEqual(DISCLOSURE_VERIFY_V1.buildInitialPrompts());
      expect(progress.at(-1)).toBe(1);
    });

    it('a v2 pipeline without the verifier prepares only its scan model', async () => {
      const servicesFor = createVariantServices(REAL_ENV);
      const result = await servicesFor(v2Pipeline('single2')).deviceCapability.prepare(
        () => undefined,
      );
      expect(result.ok).toBe(true);
      expect(sdk.initializeDeviceModel).toHaveBeenCalledTimes(1);
    });

    it('a stall abandons the model (abort signal); the next scan runs on a fresh model', async () => {
      vi.useFakeTimers();
      try {
        sdk.getGenerativeModel.mockImplementation((_ai: unknown, params: HybridParams) => {
          const signal = params.onDeviceParams?.createOptions?.signal;
          const hangs = sdk.getGenerativeModel.mock.calls.length === 1;
          const answer = { inferenceSource: InferenceSource.ON_DEVICE, text: () => MODEL_JSON };
          return {
            generateContent: () =>
              hangs ? hangUntilAborted(signal) : Promise.resolve({ response: answer }),
            initializeDeviceModel: sdk.initializeDeviceModel,
          };
        });
        const servicesFor = createVariantServices(REAL_ENV);
        const pending = servicesFor({ ...V1, strategy: 'single' }).scanReport(REPORT);
        await vi.advanceTimersByTimeAsync(120_000);
        const first = await pending;
        expect(!first.ok && first.error).toMatchObject({
          kind: 'OnDeviceStuck',
          recoverable: true,
        });
        expect(signalOf(0)?.aborted).toBe(true);

        const second = await servicesFor({ ...V1, strategy: 'single' }).scanReport(REPORT);
        expect(second.ok).toBe(true);
        expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(2);
        expect(signalOf(1)?.aborted).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('shares one queue and stuck tracker across variants (terminal stall)', async () => {
      vi.useFakeTimers();
      try {
        sdk.generateContent.mockImplementation(() => new Promise(() => undefined));
        const servicesFor = createVariantServices(REAL_ENV);
        const pending = servicesFor({ ...V1, strategy: 'single' }).scanReport(REPORT);
        await vi.advanceTimersByTimeAsync(125_000);
        const first = await pending;
        expect(!first.ok && first.error).toMatchObject({
          kind: 'OnDeviceStuck',
          recoverable: false,
        });

        const calls = sdk.generateContent.mock.calls.length;
        const second = await servicesFor({ ...V1, strategy: 'grouped2' }).scanReport(REPORT);
        expect(!second.ok && second.error).toMatchObject({ recoverable: false });
        expect(sdk.generateContent.mock.calls.length).toBe(calls);
      } finally {
        vi.useRealTimers();
      }
    });

    it('throws on an unregistered prompt version without creating a model', () => {
      sdk.getGenerativeModel.mockClear();
      const servicesFor = createVariantServices(REAL_ENV);
      const unknown = {
        promptVersion: 'identityScan.v0',
        strategy: 'single',
        chunkChars: 3000,
        postFilters: [],
        rulePack: 'core',
      } as const;
      expect(() => servicesFor(unknown)).toThrow('Unknown prompt version: identityScan.v0');
      expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
    });
  });
});
