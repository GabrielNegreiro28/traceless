import {
  getGenerativeModel,
  HarmBlockThreshold,
  HarmCategory,
  type AI,
  type Content,
  type GenerateContentResult,
  type HybridParams,
  type ObjectSchemaRequest,
  type RequestOptions,
  type SafetySetting,
} from 'firebase/ai';
import { CLOUD_MODEL_NAME, policyFor, type TaskOfDataClass } from '../../ai/policy/inferencePolicy';
import { toRawText, type ConsentedRawText, type RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import { mapCloudAiError } from './cloudErrorMapper';

/** Tasks the policy gives consented raw text (today only `identityScanConsented`). */
export type ConsentedCloudTask = TaskOfDataClass<'CONSENTED_RAW'>;

export interface ConsentedCloudModelSpec {
  /** A CONSENTED_RAW task: a RAW task does not type-check here. */
  readonly task: ConsentedCloudTask;
  readonly systemInstruction: string;
  /** Few-shot user/model turns sent before the chunk (the same pairs as on the device). */
  readonly fewShots: readonly Content[];
  readonly responseSchema: ObjectSchemaRequest;
  /** Wraps one chunk in the prompt template (the same user prompt as on the device). */
  readonly buildUserPrompt: (chunk: RawText) => RawText;
}

/**
 * What callers get instead of the SDK's GenerativeModel: one call whose only caller-supplied
 * content is a chunk of CONSENTED text. Raw text does not type-check, and streaming, chat or
 * per-call request options are unreachable.
 */
export interface ConsentedCloudModel {
  generateContent(chunk: ConsentedRawText): Promise<GenerateContentResult>;
}

/** The exact arguments `createConsentedCloudModel` passes to `getGenerativeModel`. */
export interface ConsentedCloudModelConfig {
  readonly params: HybridParams;
  readonly requestOptions: RequestOptions;
}

/**
 * Whistleblower reports describe harassment, violence and danger by nature, and the default
 * filters would refuse many of them. Content the API always blocks (for example prohibited
 * content) still surfaces as ContentBlocked.
 */
export const PERMISSIVE_SAFETY_SETTINGS: readonly SafetySetting[] = Object.values(HarmCategory).map(
  (category) => ({ category, threshold: HarmBlockThreshold.BLOCK_NONE }),
);

/** Caller-facing limit for one cloud call (the SDK default is 180 s). */
export const CLOUD_REQUEST_TIMEOUT_MS = 60_000;

/**
 * The arguments for `getGenerativeModel`: the policy's mode for the task (ONLY_IN_CLOUD, so
 * never a hybrid fallback the consent did not describe), the pinned cloud model, the prompt's
 * system instruction, JSON output with the prompt's schema and permissive safety settings.
 * Fresh objects on every call: the SDK keeps and may mutate the params it receives.
 */
export function consentedCloudModelConfig(
  spec: ConsentedCloudModelSpec,
): ConsentedCloudModelConfig {
  const { mode } = policyFor(spec.task);
  return {
    params: {
      mode,
      inCloudParams: {
        model: CLOUD_MODEL_NAME,
        systemInstruction: spec.systemInstruction,
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

function userTurn(prompt: RawText): Content {
  return { role: 'user', parts: [{ type: 'text', text: prompt }] };
}

/**
 * Creates the cloud model for a consented task. Each call sends the few-shot turns, then the
 * consented chunk wrapped in the prompt template, as one single-turn request.
 */
export function createConsentedCloudModel(
  ai: AI,
  spec: ConsentedCloudModelSpec,
): Result<ConsentedCloudModel, AppError> {
  try {
    const { params, requestOptions } = consentedCloudModelConfig(spec);
    const model = getGenerativeModel(ai, params, requestOptions);
    return ok({
      generateContent: (chunk) => {
        const prompt = spec.buildUserPrompt(toRawText(chunk));
        return model.generateContent({
          contents: [...structuredClone([...spec.fewShots]), userTurn(prompt)],
        });
      },
    });
  } catch (error) {
    return err(mapCloudAiError(error));
  }
}
