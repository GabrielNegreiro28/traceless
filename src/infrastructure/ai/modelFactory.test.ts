import {
  AIError,
  AIErrorCode,
  InferenceMode,
  type AI,
  type HybridParams,
  type LanguageModelMessage,
} from 'firebase/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOnDeviceModel,
  ON_DEVICE_ONLY_BASE_URL,
  onDeviceModelConfig,
  type OnDeviceModel,
  type OnDeviceModelSpec,
} from './modelFactory';

const sdk = vi.hoisted(() => ({ getGenerativeModel: vi.fn() }));

vi.mock('firebase/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getGenerativeModel: sdk.getGenerativeModel,
}));

const PROMPTS: LanguageModelMessage[] = [
  { role: 'system', content: [{ type: 'text', value: 'You protect whistleblowers.' }] },
];
const SCHEMA = { type: 'object', properties: { findings: { type: 'array' } } };

function spec(overrides: Partial<OnDeviceModelSpec> = {}): OnDeviceModelSpec {
  return {
    task: 'identityScan',
    groupKey: 'v1:ALL',
    initialPrompts: PROMPTS,
    responseConstraint: SCHEMA,
    ...overrides,
  };
}

function fakeAi(): AI {
  return { app: {}, location: 'test' } as unknown as AI;
}

function stubPromptApi(): void {
  vi.stubGlobal('LanguageModel', { availability: () => Promise.resolve('available') });
}

function lastCall(): [AI, HybridParams, unknown] {
  return sdk.getGenerativeModel.mock.lastCall as [AI, HybridParams, unknown];
}

describe('createOnDeviceModel', () => {
  beforeEach(() => {
    sdk.getGenerativeModel.mockImplementation(() => ({ kind: 'model', id: Symbol('model') }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('layer 1: Prompt API guard', () => {
    it('refuses to create a model when LanguageModel is missing, without calling the SDK', () => {
      expect('LanguageModel' in globalThis).toBe(false);
      const result = createOnDeviceModel(fakeAi(), spec());
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.kind).toBe('OnDeviceUnavailable');
      expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
    });

    it('refuses a LanguageModel global the SDK would treat as missing', () => {
      vi.stubGlobal('LanguageModel', undefined);
      expect(createOnDeviceModel(fakeAi(), spec()).ok).toBe(false);
      expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
    });

    it('re-checks the guard even when the model is already memoized', () => {
      const ai = fakeAi();
      stubPromptApi();
      expect(createOnDeviceModel(ai, spec()).ok).toBe(true);
      vi.unstubAllGlobals();
      expect(createOnDeviceModel(ai, spec()).ok).toBe(false);
      expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(1);
    });
  });

  describe('layer 2 and model parameters', () => {
    beforeEach(stubPromptApi);

    it('creates a RAW model ONLY_ON_DEVICE, English text only, with a dead cloud endpoint', () => {
      const ai = fakeAi();
      const result = createOnDeviceModel(ai, spec());
      expect(result.ok).toBe(true);
      const [calledAi, params, requestOptions] = lastCall();
      expect(calledAi).toBe(ai);
      expect(params.mode).toBe(InferenceMode.ONLY_ON_DEVICE);
      expect(params.mode).toBe('only_on_device');
      expect(requestOptions).toEqual({ baseUrl: 'https://on-device-only.invalid' });
      expect(ON_DEVICE_ONLY_BASE_URL).toBe('https://on-device-only.invalid');
      expect(params.onDeviceParams?.createOptions?.expectedInputs).toEqual([
        { type: 'text', languages: ['en'] },
      ]);
      expect(params.onDeviceParams?.createOptions?.expectedOutputs).toEqual([
        { type: 'text', languages: ['en'] },
      ]);
    });

    it('passes the prompts and schema as fresh copies, and nothing for the cloud', () => {
      createOnDeviceModel(fakeAi(), spec());
      const [, params] = lastCall();
      const { createOptions, promptOptions } = params.onDeviceParams ?? {};
      expect(Object.keys(params).sort()).toEqual(['mode', 'onDeviceParams']);
      expect(createOptions?.initialPrompts).toEqual(PROMPTS);
      expect(createOptions?.initialPrompts).not.toBe(PROMPTS);
      expect(createOptions?.initialPrompts?.[0]).not.toBe(PROMPTS[0]);
      expect(promptOptions?.responseConstraint).toEqual(SCHEMA);
      expect(promptOptions?.responseConstraint).not.toBe(SCHEMA);
    });

    it('takes the mode from the inference policy for every on-device task', () => {
      createOnDeviceModel(fakeAi(), spec({ task: 'styleNeutralize' }));
      const [, params, requestOptions] = lastCall();
      expect(params.mode).toBe('only_on_device');
      expect(requestOptions).toEqual({ baseUrl: ON_DEVICE_ONLY_BASE_URL });
    });

    it('memoizes one model per AI instance, task and group, with fresh params per creation', () => {
      const ai = fakeAi();
      const first = createOnDeviceModel(ai, spec());
      const again = createOnDeviceModel(ai, spec());
      const otherGroup = createOnDeviceModel(ai, spec({ groupKey: 'v1:SCHEDULE' }));
      const otherTask = createOnDeviceModel(ai, spec({ task: 'styleNeutralize' }));
      const otherAi = createOnDeviceModel(fakeAi(), spec());
      expect(first.ok && again.ok && first.value === again.value).toBe(true);
      expect(otherGroup.ok && first.ok && otherGroup.value !== first.value).toBe(true);
      expect(otherTask.ok && otherAi.ok).toBe(true);
      expect(sdk.getGenerativeModel).toHaveBeenCalledTimes(4);
      const [a, b] = sdk.getGenerativeModel.mock.calls as [AI, HybridParams][];
      expect(a?.[1].onDeviceParams).not.toBe(b?.[1].onDeviceParams);
      expect(a?.[1].onDeviceParams?.createOptions?.expectedInputs).not.toBe(
        b?.[1].onDeviceParams?.createOptions?.expectedInputs,
      );
    });

    it('builds exactly the config it passes to getGenerativeModel', () => {
      createOnDeviceModel(fakeAi(), spec());
      const [, params, requestOptions] = lastCall();
      const signal = params.onDeviceParams?.createOptions?.signal;
      if (signal === undefined) throw new Error('expected an abort signal');
      const config = onDeviceModelConfig(spec(), signal);
      expect(params).toEqual(config.params);
      expect(requestOptions).toEqual(config.requestOptions);
      expect(onDeviceModelConfig(spec(), signal).requestOptions).not.toBe(config.requestOptions);
    });

    it('maps an SDK exception to an AppError and does not memoize the failure', () => {
      const ai = fakeAi();
      sdk.getGenerativeModel.mockImplementationOnce(() => {
        throw new AIError(AIErrorCode.NO_MODEL, 'no model');
      });
      const failed = createOnDeviceModel(ai, spec());
      expect(!failed.ok && failed.error.kind).toBe('Unknown');
      expect(createOnDeviceModel(ai, spec()).ok).toBe(true);
    });
  });

  describe('narrowed model', () => {
    beforeEach(stubPromptApi);

    function sdkModel() {
      return {
        generateContent: vi.fn(() => Promise.resolve({ response: { text: () => '{}' } })),
        generateContentStream: vi.fn(),
        countTokens: vi.fn(),
        startChat: vi.fn(),
        initializeDeviceModel: vi.fn(() => Promise.resolve()),
      };
    }

    it('exposes only generateContent, initializeDeviceModel and abandon', () => {
      sdk.getGenerativeModel.mockImplementation(sdkModel);
      const result = createOnDeviceModel(fakeAi(), spec());
      if (!result.ok) throw new Error('expected a model');
      expect(Object.keys(result.value).sort()).toEqual([
        'abandon',
        'generateContent',
        'initializeDeviceModel',
      ]);
    });

    it('forwards generateContent with the prompt only, never request options', async () => {
      const underlying = sdkModel();
      sdk.getGenerativeModel.mockImplementation(() => underlying);
      const result = createOnDeviceModel(fakeAi(), spec());
      if (!result.ok) throw new Error('expected a model');
      const model: OnDeviceModel = result.value;
      // @ts-expect-error per-call request options could override the dead baseUrl
      await model.generateContent('prompt', { baseUrl: 'https://firebasevertexai.googleapis.com' });
      expect(underlying.generateContent).toHaveBeenCalledTimes(1);
      expect(underlying.generateContent.mock.calls[0]).toEqual(['prompt']);
    });

    it('forwards initializeDeviceModel with the progress callback', async () => {
      const underlying = sdkModel();
      sdk.getGenerativeModel.mockImplementation(() => underlying);
      const result = createOnDeviceModel(fakeAi(), spec());
      if (!result.ok) throw new Error('expected a model');
      const onProgress = vi.fn();
      await result.value.initializeDeviceModel(onProgress);
      expect(underlying.initializeDeviceModel).toHaveBeenCalledWith(onProgress);
    });
  });
});
