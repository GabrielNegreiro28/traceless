import {
  getGenerativeModel,
  type AI,
  type GenerateContentResult,
  type HybridParams,
  type LanguageModelMessage,
  type ObjectSchemaRequest,
  type RequestOptions,
} from 'firebase/ai';
import { CLOUD_MODEL_NAME, policyFor, type TaskOfDataClass } from '../../ai/policy/inferencePolicy';
import type { SanitizedText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import { mapCloudAiError } from './cloudErrorMapper';
import { CLOUD_REQUEST_TIMEOUT_MS, PERMISSIVE_SAFETY_SETTINGS } from './consentedCloudModel';
import { onDeviceTextOptions } from './languageModelGlobal';

/**
 * Tasks the policy gives APPROVED text. Only these may use a hybrid (cloud-capable) model:
 * a RAW or CONSENTED_RAW task does not type-check here.
 */
export type SanitizedTask = TaskOfDataClass<'SANITIZED'>;

export interface HybridModelSpec {
  readonly task: SanitizedTask;
  /** The system prompt: on the device as `initialPrompts`, in the cloud as systemInstruction. */
  readonly systemPrompt: string;
  readonly initialPrompts: readonly LanguageModelMessage[];
  /** One schema for both paths (Prompt API responseConstraint, Gemini responseSchema). */
  readonly responseSchema: ObjectSchemaRequest;
  readonly buildUserPrompt: (text: SanitizedText) => string;
}

/**
 * What callers get instead of the SDK's GenerativeModel: one single-turn call whose only
 * caller-supplied content is APPROVED text. Streaming, chat and request options are
 * unreachable.
 */
export interface HybridModel {
  generateContent(text: SanitizedText): Promise<GenerateContentResult>;
}

export interface HybridModelConfig {
  readonly params: HybridParams;
  readonly requestOptions: RequestOptions;
}

/**
 * The arguments for `getGenerativeModel`: the policy's mode for the task (PREFER_IN_CLOUD
 * for structureReport: the cloud model, and the SDK falls back to the on-device model on a
 * network or API error, e.g. offline), English
 * text in and out on the device, the pinned cloud model, and JSON output with the same schema
 * on both paths. Fresh objects on every call: the SDK keeps and may mutate its params.
 */
export function hybridModelConfig(spec: HybridModelSpec): HybridModelConfig {
  const { mode } = policyFor(spec.task);
  return {
    params: {
      mode,
      onDeviceParams: {
        createOptions: {
          ...onDeviceTextOptions(),
          initialPrompts: structuredClone([...spec.initialPrompts]),
        },
        promptOptions: { responseConstraint: structuredClone(spec.responseSchema) },
      },
      inCloudParams: {
        model: CLOUD_MODEL_NAME,
        systemInstruction: spec.systemPrompt,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: structuredClone(spec.responseSchema),
        },
        safetySettings: PERMISSIVE_SAFETY_SETTINGS.map((setting) => ({ ...setting })),
      },
    },
    requestOptions: { timeout: CLOUD_REQUEST_TIMEOUT_MS },
  };
}

/**
 * Creates the hybrid model for a SANITIZED task on the shared AI instance (getAiService:
 * limited-use App Check tokens, so cloud calls carry replay protection).
 */
export function createHybridModel(ai: AI, spec: HybridModelSpec): Result<HybridModel, AppError> {
  try {
    const { params, requestOptions } = hybridModelConfig(spec);
    const model = getGenerativeModel(ai, params, requestOptions);
    return ok({ generateContent: (text) => model.generateContent(spec.buildUserPrompt(text)) });
  } catch (error) {
    return err(mapCloudAiError(error));
  }
}
