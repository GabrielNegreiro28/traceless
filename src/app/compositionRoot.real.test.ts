import { InferenceSource, type HybridParams } from 'firebase/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toRawText } from '../domain/text/brandedText';
import { createServices } from './compositionRoot';
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

function respond(inferenceSource: InferenceSource): void {
  sdk.generateContent.mockResolvedValue({ response: { inferenceSource, text: () => MODEL_JSON } });
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
  });
});
