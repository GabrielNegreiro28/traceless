import { HarmBlockThreshold, InferenceMode, type AI } from 'firebase/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOUD_MODEL_NAME } from '../../ai/policy/inferencePolicy';
import { approvedText } from '../../application/usecases/submitReport.testKit';
import { structureReportModelSpec } from './adapters/structureReportModelSpec';
import { CLOUD_REQUEST_TIMEOUT_MS } from './consentedCloudModel';
import { createHybridModel, hybridModelConfig, type HybridModelSpec } from './hybridModel';

const sdk = vi.hoisted(() => ({ getGenerativeModel: vi.fn(), generateContent: vi.fn() }));

vi.mock('firebase/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getGenerativeModel: sdk.getGenerativeModel,
}));

const AI_INSTANCE = { app: {} } as unknown as AI;
const SPEC = structureReportModelSpec();

beforeEach(() => {
  sdk.getGenerativeModel.mockReset();
  sdk.generateContent.mockReset();
  sdk.getGenerativeModel.mockReturnValue({ generateContent: sdk.generateContent });
});

describe('hybridModelConfig', () => {
  it('runs PREFER_IN_CLOUD for approved text, with the on-device model as offline fallback', () => {
    const { params } = hybridModelConfig(SPEC);
    expect(params.mode).toBe(InferenceMode.PREFER_IN_CLOUD);
    expect(params.onDeviceParams).toBeDefined();
  });

  it('declares English text in and out on the device, with the schema as constraint', () => {
    const { onDeviceParams } = hybridModelConfig(SPEC).params;
    expect(onDeviceParams?.createOptions).toMatchObject({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      initialPrompts: SPEC.initialPrompts,
    });
    expect(onDeviceParams?.promptOptions?.responseConstraint).toEqual(SPEC.responseSchema);
  });

  it('uses the pinned cloud model with the same system text and JSON schema', () => {
    const { params, requestOptions } = hybridModelConfig(SPEC);
    expect(params.inCloudParams).toMatchObject({
      model: CLOUD_MODEL_NAME,
      systemInstruction: SPEC.systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SPEC.responseSchema,
      },
    });
    for (const setting of params.inCloudParams?.safetySettings ?? []) {
      expect(setting.threshold).toBe(HarmBlockThreshold.BLOCK_NONE);
    }
    expect(requestOptions).toEqual({ timeout: CLOUD_REQUEST_TIMEOUT_MS });
  });

  it('returns fresh objects (the SDK may mutate what it receives)', () => {
    const { params } = hybridModelConfig(SPEC);
    expect(params.inCloudParams?.generationConfig?.responseSchema).not.toBe(SPEC.responseSchema);
    expect(params.onDeviceParams?.createOptions?.initialPrompts).not.toBe(SPEC.initialPrompts);
  });

  it('accepts only SANITIZED tasks (type level)', () => {
    // @ts-expect-error a RAW task can never configure a cloud-capable model
    const raw: HybridModelSpec = { ...SPEC, task: 'identityScan' };
    // @ts-expect-error neither can the consented raw task
    const consented: HybridModelSpec = { ...SPEC, task: 'identityScanConsented' };
    expect([raw.task, consented.task]).toHaveLength(2);
  });
});

describe('createHybridModel', () => {
  it('sends the approved text wrapped in the prompt template, single turn', async () => {
    const created = createHybridModel(AI_INSTANCE, SPEC);
    if (!created.ok) throw new Error('model not created');
    await created.value.generateContent(approvedText('Invoices were doubled.'));
    expect(sdk.getGenerativeModel).toHaveBeenCalledWith(
      AI_INSTANCE,
      expect.objectContaining({ mode: 'prefer_in_cloud' }),
      { timeout: CLOUD_REQUEST_TIMEOUT_MS },
    );
    expect(sdk.generateContent).toHaveBeenCalledWith('<report>\nInvoices were doubled.\n</report>');
  });

  it('maps a throwing SDK to an AppError', () => {
    sdk.getGenerativeModel.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(createHybridModel(AI_INSTANCE, SPEC)).toMatchObject({
      ok: false,
      error: { kind: 'Unknown' },
    });
  });
});
