import {
  HarmBlockThreshold,
  HarmCategory,
  type AI,
  type Content,
  type GenerateContentRequest,
} from 'firebase/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOUD_MODEL_NAME } from '../../ai/policy/inferencePolicy';
import { toRawText } from '../../domain/text/brandedText';
import {
  CLOUD_REQUEST_TIMEOUT_MS,
  consentedCloudModelConfig,
  createConsentedCloudModel,
  type ConsentedCloudModel,
  type ConsentedCloudModelSpec,
} from './consentedCloudModel';
import { consentedText } from './consentedText.testKit';

const sdk = vi.hoisted(() => ({ getGenerativeModel: vi.fn(), generateContent: vi.fn() }));

vi.mock('firebase/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getGenerativeModel: sdk.getGenerativeModel,
}));

const AI_INSTANCE = { app: {} } as unknown as AI;
const FEW_SHOTS: Content[] = [
  { role: 'user', parts: [{ type: 'text', text: 'example report' }] },
  { role: 'model', parts: [{ type: 'text', text: '{"findings":[]}' }] },
];
const SPEC: ConsentedCloudModelSpec = {
  task: 'identityScanConsented',
  systemInstruction: 'You protect whistleblowers.',
  fewShots: FEW_SHOTS,
  responseSchema: { type: 'object', properties: {} },
  buildUserPrompt: (chunk) => toRawText(`<report>${chunk}</report>`),
};

describe('consentedCloudModelConfig', () => {
  it('runs ONLY_IN_CLOUD on the pinned model with the prompt, JSON schema and a timeout', () => {
    const { params, requestOptions } = consentedCloudModelConfig(SPEC);
    expect(params.mode).toBe('only_in_cloud');
    expect(params.onDeviceParams).toBeUndefined();
    expect(params.inCloudParams).toMatchObject({
      model: CLOUD_MODEL_NAME,
      systemInstruction: 'You protect whistleblowers.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: { type: 'object', properties: {} },
      },
    });
    expect(requestOptions).toEqual({ timeout: CLOUD_REQUEST_TIMEOUT_MS });
  });

  it('is permissive on every harm category (reports describe harm by nature)', () => {
    const settings = consentedCloudModelConfig(SPEC).params.inCloudParams?.safetySettings ?? [];
    expect(settings.map((s) => s.category).sort()).toEqual(Object.values(HarmCategory).sort());
    for (const setting of settings) expect(setting.threshold).toBe(HarmBlockThreshold.BLOCK_NONE);
  });

  it('returns fresh objects (the SDK may mutate what it receives)', () => {
    const first = consentedCloudModelConfig(SPEC);
    const second = consentedCloudModelConfig(SPEC);
    expect(first.params.inCloudParams?.generationConfig?.responseSchema).not.toBe(
      SPEC.responseSchema,
    );
    expect(first.params.inCloudParams?.safetySettings).not.toBe(
      second.params.inCloudParams?.safetySettings,
    );
  });

  it('accepts only CONSENTED_RAW tasks (type level)', () => {
    // @ts-expect-error a RAW task can never configure the consented cloud model
    const raw: ConsentedCloudModelSpec = { ...SPEC, task: 'identityScan' };
    // @ts-expect-error neither can a SANITIZED task
    const sanitized: ConsentedCloudModelSpec = { ...SPEC, task: 'triageCase' };
    expect([raw.task, sanitized.task]).toHaveLength(2);
  });
});

describe('createConsentedCloudModel', () => {
  beforeEach(() => {
    sdk.getGenerativeModel.mockReset();
    sdk.generateContent.mockReset();
    sdk.getGenerativeModel.mockReturnValue({ generateContent: sdk.generateContent });
    sdk.generateContent.mockResolvedValue({ response: { text: () => '{"findings":[]}' } });
  });

  function created(): ConsentedCloudModel {
    const model = createConsentedCloudModel(AI_INSTANCE, SPEC);
    if (!model.ok) throw new Error(model.error.kind);
    return model.value;
  }

  it('creates the model from the config, with no on-device parameters', () => {
    created();
    expect(sdk.getGenerativeModel).toHaveBeenCalledExactlyOnceWith(
      AI_INSTANCE,
      consentedCloudModelConfig(SPEC).params,
      { timeout: CLOUD_REQUEST_TIMEOUT_MS },
    );
  });

  it('sends the few-shot turns, then the chunk in the prompt template, in one request', async () => {
    const model = created();
    const chunk = consentedText('I am the only night nurse.');
    await model.generateContent(chunk);
    const request = sdk.generateContent.mock.calls[0]?.[0] as GenerateContentRequest;
    expect(sdk.generateContent.mock.calls[0]).toHaveLength(1);
    expect(request.contents).toEqual([
      ...FEW_SHOTS,
      {
        role: 'user',
        parts: [{ type: 'text', text: '<report>I am the only night nurse.</report>' }],
      },
    ]);
  });

  it('maps a throwing factory to an AppError', () => {
    sdk.getGenerativeModel.mockImplementation(() => {
      throw new TypeError('no fetch');
    });
    expect(createConsentedCloudModel(AI_INSTANCE, SPEC)).toMatchObject({
      ok: false,
      error: { kind: 'Offline' },
    });
  });

  it('accepts only consented text (type level)', () => {
    const model = created();
    const neverRun = () =>
      // @ts-expect-error raw text must go through consentToCloudScan() first
      model.generateContent(toRawText('raw report text'));
    expect(neverRun).toBeTypeOf('function');
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });
});
