import {
  getGenerativeModel,
  type AI,
  type GenerateContentResult,
  type GenerativeModel,
  type HybridParams,
  type LanguageModelMessage,
  type RequestOptions,
} from 'firebase/ai';
import {
  INFERENCE_MODES,
  policyFor,
  type AiTask,
  type InferencePolicy,
} from '../../ai/policy/inferencePolicy';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import { mapAiError } from './errorMapper';
import { onDeviceTextOptions, readLanguageModel } from './languageModelGlobal';

/** Tasks the inference policy pins to the device (today exactly the RAW-text tasks). */
export type OnDeviceOnlyTask = {
  [K in AiTask]: InferencePolicy[K]['mode'] extends 'only_on_device' ? K : never;
}[AiTask];

type OnDeviceOnlyMode = InferencePolicy[OnDeviceOnlyTask]['mode'];

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
 * each call by `GenerativeModel.generateContent` (l.3335-3349). That merge lets a per-call
 * option override it (a per-call `baseUrl` wins over this one), which is why
 * `OnDeviceModel` exposes no options argument.
 */
export const ON_DEVICE_ONLY_BASE_URL = 'https://on-device-only.invalid';

/**
 * What callers get instead of the SDK's GenerativeModel: a wrapper with only the two
 * calls the app makes. Streaming, chat, countTokens and per-call request options are
 * unreachable, so no caller can open a code path this layer has not vetted.
 */
export interface OnDeviceModel {
  /** Exactly one argument: per-call request options are never forwarded. */
  generateContent(prompt: string): Promise<GenerateContentResult>;
  initializeDeviceModel(onDownloadProgress?: (progressValue: number) => void): Promise<void>;
}

/** The exact arguments `createOnDeviceModel` passes to `getGenerativeModel`. */
export interface OnDeviceModelConfig {
  readonly params: HybridParams;
  readonly requestOptions: RequestOptions;
}

const PROMPT_API_MISSING = createAppError('OnDeviceUnavailable', {
  message: 'This browser has no Prompt API (LanguageModel); the on-device model was not created.',
});

const models = new WeakMap<AI, Map<string, OnDeviceModel>>();

function cacheFor(ai: AI): Map<string, OnDeviceModel> {
  let cache = models.get(ai);
  if (cache === undefined) {
    cache = new Map();
    models.set(ai, cache);
  }
  return cache;
}

/**
 * Keyed on the MODE, not the data class: every model pinned ONLY_ON_DEVICE gets the dead
 * endpoint. A new mode admitted into OnDeviceOnlyTask must add its own row here.
 */
const REQUEST_OPTIONS_BY_MODE: Readonly<Record<OnDeviceOnlyMode, RequestOptions>> = {
  [INFERENCE_MODES.ONLY_ON_DEVICE]: { baseUrl: ON_DEVICE_ONLY_BASE_URL },
};

/**
 * The arguments for `getGenerativeModel`. Fresh objects on every call: the SDK keeps and
 * may mutate the params it receives. Exported for the SDK contract test.
 */
export function onDeviceModelConfig(spec: OnDeviceModelSpec): OnDeviceModelConfig {
  const { mode } = policyFor(spec.task);
  return {
    params: {
      mode,
      onDeviceParams: {
        createOptions: {
          ...onDeviceTextOptions(),
          initialPrompts: structuredClone([...spec.initialPrompts]),
        },
        promptOptions: { responseConstraint: structuredClone(spec.responseConstraint) },
      },
    },
    requestOptions: { ...REQUEST_OPTIONS_BY_MODE[mode] },
  };
}

/** Narrows the SDK model to OnDeviceModel at runtime, not just in the types. */
function narrow(model: GenerativeModel): OnDeviceModel {
  return {
    generateContent: (prompt) => model.generateContent(prompt),
    initializeDeviceModel: (onDownloadProgress) => model.initializeDeviceModel(onDownloadProgress),
  };
}

/**
 * Creates (once per AI instance, task and groupKey) the on-device-only model for a task.
 *
 * LAYER 1 (factory guard). In firebase 13.3.0 `chromeAdapterFactory` returns undefined
 * when `window.LanguageModel` is missing (l.1224-1231), and `callCloudOrDevice` then
 * sends the request to the cloud for ANY mode, ONLY_ON_DEVICE included (l.2561-2567).
 * So the Prompt API global is checked synchronously right before `getGenerativeModel`;
 * without it no model is created and nothing can be sent.
 *
 * Assumption: this is the BROWSER build of @firebase/ai (dist/esm/index.esm.js), which the
 * app always ships (Vite resolves the `browser` export condition). The Node build
 * (dist/index.node.mjs) registers an AIService without `chromeAdapterFactory`, so there
 * every model has no adapter and goes to the cloud; only layer 2 would protect RAW text.
 * The app is browser-only, and src/infrastructure/ai/sdkContract.test.ts pins this
 * behaviour against the real browser build. No post-creation adapter check is made: it
 * would have to read the SDK's private `chromeAdapter` field.
 */
export function createOnDeviceModel(
  ai: AI,
  spec: OnDeviceModelSpec,
): Result<OnDeviceModel, AppError> {
  const cache = cacheFor(ai);
  const key = `${spec.task}\u0000${spec.groupKey}`;
  if (readLanguageModel(globalThis) === undefined) return err(PROMPT_API_MISSING);
  const cached = cache.get(key);
  if (cached !== undefined) return ok(cached);
  try {
    const { params, requestOptions } = onDeviceModelConfig(spec);
    const model = narrow(getGenerativeModel(ai, params, requestOptions));
    cache.set(key, model);
    return ok(model);
  } catch (error) {
    return err(mapAiError(error));
  }
}
