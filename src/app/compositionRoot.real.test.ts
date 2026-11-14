import { InferenceSource, type HybridParams } from 'firebase/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPromptModule } from '../ai/prompts/promptRegistry';
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
        ['only night nurse', 'MODEL'],
      ]);
      expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
      const [, params, requestOptions] = sdk.getGenerativeModel.mock.lastCall as [
        unknown,
        HybridParams,
        unknown,
      ];
      expect(params.mode).toBe('only_on_device');
      expect(requestOptions).toEqual({ baseUrl: 'https://on-device-only.invalid' });
    });

    it('ships v2-single2 by default (§G.1): v2 prompts, two passes, post-filters on', async () => {
      const outlet = { quote: 'The head nurse', category: 'REPORTED_PERSON', reason: 'r' };
      const v2Json = JSON.stringify({ findings: [{ ...outlet, suggestion: '' }] });
      respond(InferenceSource.ON_DEVICE, v2Json);
      const result = await createServices(REAL_ENV).scanReport(REPORT);
      if (!result.ok) throw new Error(result.error.kind);
      expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
      expect(sdk.generateContent).toHaveBeenCalledTimes(2);
      const [, params] = sdk.getGenerativeModel.mock.lastCall as [unknown, HybridParams];
      const v2 = getPromptModule('identityScan.v2');
      expect(params.onDeviceParams?.createOptions?.initialPrompts).toEqual(
        v2?.buildInitialPrompts(MODEL_FINDING_CATEGORIES),
      );
      // Only the protectedMentions post-filter turns the outlet quote into a protected span.
      expect(result.value.protectedSpans).toEqual([{ start: 37, end: 51 }]);
    });

    it('discards an in-cloud answer as a privacy violation', async () => {
      respond(InferenceSource.IN_CLOUD);
      const result = await createServices(REAL_ENV).scanReport(REPORT);
      expect(!result.ok && result.error.kind).toBe('PrivacyViolation');
    });

    it('prepares the model through initializeDeviceModel', async () => {
      const result = await createServices(REAL_ENV).deviceCapability.prepare(() => undefined);
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
