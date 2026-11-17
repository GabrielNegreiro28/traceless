import { InferenceSource, type HybridParams } from 'firebase/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOUD_MODEL_NAME } from '../ai/policy/inferencePolicy';
import { MODEL_CHUNK_CHARS } from '../ai/prompts/identityScan.v1';
import { buildSystemPrompt as v2SystemPrompt } from '../ai/prompts/identityScan.v2';
import { MODEL_FINDING_CATEGORIES } from '../ai/schemas/identityScan';
import { chunkText } from '../domain/detection/textChunker';
import { SAMPLE_REPORT } from '../domain/report/sampleReport';
import { toRawText } from '../domain/text/brandedText';
import { createServices } from './compositionRoot';
import type { AppEnv } from './env';

/**
 * Real-mode wiring of the consented cloud scan with the SDK boundary mocked (no network):
 * the cloud model is ONLY_IN_CLOUD on the pinned model, it is the only model created, the
 * kill switch comes from Remote Config, and the on-device path still fails closed.
 */
const sdk = vi.hoisted(() => ({
  getAI: vi.fn(),
  getGenerativeModel: vi.fn(),
  generateContent: vi.fn(),
  bootstrapFirebase: vi.fn(),
  getBoolean: vi.fn(),
}));

vi.mock('firebase/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAI: sdk.getAI,
  getGenerativeModel: sdk.getGenerativeModel,
}));
vi.mock('firebase/remote-config', () => ({
  getRemoteConfig: () => ({ defaultConfig: {}, settings: {} }),
  fetchAndActivate: () => Promise.resolve(true),
  getBoolean: sdk.getBoolean,
  getNumber: () => 7,
  isSupported: () => Promise.resolve(true),
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

const SAMPLE = toRawText(SAMPLE_REPORT);
const chunkCount = (text: typeof SAMPLE) => chunkText(text, MODEL_CHUNK_CHARS).length;
const MODEL_JSON = JSON.stringify({
  findings: [
    {
      quote: 'the only night-shift forklift trainer',
      category: 'ROLE_UNIQUE',
      reason: 'Unique role.',
      suggestion: 'a forklift trainer',
    },
  ],
});

const paramsOf = (call: number) =>
  sdk.getGenerativeModel.mock.calls[call]?.[1] as HybridParams | undefined;

describe('createServices: consented cloud scan (real AI mode, SDK mocked)', () => {
  beforeEach(() => {
    sdk.bootstrapFirebase.mockImplementation(() => ({ name: 'app' }));
    sdk.getAI.mockImplementation(() => ({ id: Symbol('ai') }));
    sdk.getGenerativeModel.mockImplementation(() => ({ generateContent: sdk.generateContent }));
    sdk.generateContent.mockResolvedValue({
      response: { inferenceSource: InferenceSource.IN_CLOUD, text: () => MODEL_JSON },
    });
    sdk.getBoolean.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('scans the sample in the cloud on an ONLY_IN_CLOUD model, without the Prompt API', async () => {
    const services = createServices(REAL_ENV);
    const result = await services.scanWithCloudConsent(SAMPLE, { kind: 'sample' });
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.source).toBe('IN_CLOUD');
    expect(result.value.findings.map((f) => f.quote)).toContain(
      'the only night-shift forklift trainer',
    );
    const created = sdk.getGenerativeModel.mock.calls.map((_, i) => paramsOf(i));
    expect(created.length).toBeGreaterThan(0);
    for (const params of created) {
      expect(params?.mode).toBe('only_in_cloud');
      expect(params?.inCloudParams?.model).toBe(CLOUD_MODEL_NAME);
      expect(params?.onDeviceParams).toBeUndefined();
    }
    expect(services.privacyLedger.entries()).toMatchObject([
      { task: 'identityScan', source: 'cloud', dataClass: 'CONSENTED_RAW', demo: false },
    ]);
  });

  it('binds the cloud scan to the v2 prompt (single2), never the shipped device pipeline', async () => {
    const services = createServices(REAL_ENV);
    const result = await services.scanWithCloudConsent(SAMPLE, { kind: 'sample' });
    expect(result.ok).toBe(true);
    const created = sdk.getGenerativeModel.mock.calls.map((_, i) => paramsOf(i));
    const v2System = v2SystemPrompt(MODEL_FINDING_CATEGORIES);
    expect(new Set(created.map((p) => p?.inCloudParams?.systemInstruction))).toEqual(
      new Set([v2System]),
    );
    // single2: the full category list twice per chunk; no verifier call in the cloud.
    expect(sdk.generateContent.mock.calls.length).toBe(2 * chunkCount(SAMPLE));
    for (const [prompt] of sdk.generateContent.mock.calls) {
      expect(String(prompt)).not.toContain('\nPhrases:\n');
    }
  });

  it('refuses before any model exists when Remote Config switches the cloud scan off', async () => {
    sdk.getBoolean.mockReturnValue(false);
    const services = createServices(REAL_ENV);
    await expect(services.config.load()).resolves.toMatchObject({ cloudScanEnabled: false });
    const result = await services.scanWithCloudConsent(SAMPLE, { kind: 'sample' });
    expect(result).toMatchObject({ ok: false, error: { kind: 'CloudScanDisabled' } });
    expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });

  it('keeps the on-device scan fail-closed: it never reuses the cloud model', async () => {
    const services = createServices(REAL_ENV);
    const onDevice = await services.scanReport(SAMPLE);
    expect(!onDevice.ok && onDevice.error.kind).toBe('OnDeviceUnavailable');
    expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
  });
});
