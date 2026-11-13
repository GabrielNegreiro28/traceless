import {
  getGenerativeModel,
  type AI,
  type GenerativeModel,
  type HybridParams,
  type LanguageModelMessage,
  type RequestOptions,
} from 'firebase/ai';
import { policyFor, type AiTask, type InferencePolicy } from '../../ai/policy/inferencePolicy';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import { mapAiError } from './errorMapper';
import { onDeviceTextOptions, readLanguageModel } from './languageModelGlobal';

/** Tasks the inference policy pins to the device (today exactly the RAW-text tasks). */
export type OnDeviceOnlyTask = {
  [K in AiTask]: InferencePolicy[K]['mode'] extends 'only_on_device' ? K : never;
}[AiTask];

export interface OnDeviceModelSpec {
  readonly task: OnDeviceOnlyTask;
  /** Identifies the prompt configuration (prompt version + categories): the memo key. */
  readonly groupKey: string;
  /** System prompt and few-shot pairs (the on-device path ignores systemInstruction). */
  readonly initialPrompts: readonly LanguageModelMessage[];
  /** JSON Schema for structured output (Prompt API `responseConstraint`). */
  readonly responseConstraint: object;
}

/**
 * LAYER 2 (dead cloud endpoint). `.invalid` is reserved by RFC 6761 and never resolves,
 * so even if an SDK path took the cloud branch for a RAW model, the request could not
 * be delivered. The SDK builds every cloud URL from `requestOptions.baseUrl`
 * (`RequestURL.baseUrl`, @firebase/ai dist/esm/index.esm.js l.1488-1489), merged into
 * each call by `GenerativeModel.generateContent` (l.3335-3349).
 */
export const ON_DEVICE_ONLY_BASE_URL = 'https://on-device-only.invalid';

const PROMPT_API_MISSING = createAppError('OnDeviceUnavailable', {
  message: 'This browser has no Prompt API (LanguageModel); the on-device model was not created.',
});

const models = new WeakMap<AI, Map<string, GenerativeModel>>();

function cacheFor(ai: AI): Map<string, GenerativeModel> {
  let cache = models.get(ai);
  if (cache === undefined) {
    cache = new Map();
    models.set(ai, cache);
  }
  return cache;
}

/** Fresh objects on every call: the SDK keeps and may mutate the params it receives. */
function hybridParamsFor(spec: OnDeviceModelSpec): HybridParams {
  return {
    mode: policyFor(spec.task).mode,
    onDeviceParams: {
      createOptions: {
        ...onDeviceTextOptions(),
        initialPrompts: structuredClone([...spec.initialPrompts]),
      },
      promptOptions: { responseConstraint: structuredClone(spec.responseConstraint) },
    },
  };
}

function requestOptionsFor(task: OnDeviceOnlyTask): RequestOptions | undefined {
  return policyFor(task).dataClass === 'RAW' ? { baseUrl: ON_DEVICE_ONLY_BASE_URL } : undefined;
}

/**
 * Creates (once per AI instance, task and groupKey) the on-device-only model for a task.
 *
 * LAYER 1 (factory guard). In firebase 13.3.0 `chromeAdapterFactory` returns undefined
 * when `window.LanguageModel` is missing (l.1224-1231), and `callCloudOrDevice` then
 * sends the request to the cloud for ANY mode, ONLY_ON_DEVICE included (l.2561-2567).
 * So the Prompt API global is checked synchronously right before `getGenerativeModel`;
 * without it no model is created and nothing can be sent.
 */
export function createOnDeviceModel(
  ai: AI,
  spec: OnDeviceModelSpec,
): Result<GenerativeModel, AppError> {
  const cache = cacheFor(ai);
  const key = `${spec.task}\u0000${spec.groupKey}`;
  if (readLanguageModel(globalThis) === undefined) return err(PROMPT_API_MISSING);
  const cached = cache.get(key);
  if (cached !== undefined) return ok(cached);
  try {
    const model = getGenerativeModel(ai, hybridParamsFor(spec), requestOptionsFor(spec.task));
    cache.set(key, model);
    return ok(model);
  } catch (error) {
    return err(mapAiError(error));
  }
}
