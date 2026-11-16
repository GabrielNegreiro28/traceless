import { InferenceSource } from 'firebase/ai';
import type { InferenceSourceKind } from '../../application/ports/IdentityScanner';
import type { ConsentedRawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { GroupRunner } from './adapters/groupPasses';
import { mapCloudAiError } from './cloudErrorMapper';
import {
  DEFAULT_TRANSIENT_RETRY,
  retryTransient,
  type TransientRetryOptions,
} from './transientRetry';

/** The slice of ConsentedCloudModel the runner uses. */
export interface ConsentedPromptableModel {
  generateContent(chunk: ConsentedRawText): Promise<{
    readonly response: { readonly inferenceSource?: InferenceSource; text(): string };
  }>;
}

/** Maps, never casts: anything but the SDK's ON_DEVICE value counts as off-device. */
function sourceOf(inferenceSource: InferenceSource | undefined): InferenceSourceKind {
  return inferenceSource === InferenceSource.ON_DEVICE ? 'ON_DEVICE' : 'IN_CLOUD';
}

/**
 * Sends one consented chunk to the cloud model and reports where it really ran (from the
 * SDK's `inferenceSource`). The model is created on the first call and reused. A transient
 * failure (HTTP 5xx) is retried with a short backoff unless the caller cancelled
 * (transientRetry.ts). Never rejects: every failure, including a safety block raised by
 * `text()`, becomes an AppError.
 */
export function createConsentedCloudRunner(
  getModel: () => Result<ConsentedPromptableModel, AppError>,
  retry: TransientRetryOptions = DEFAULT_TRANSIENT_RETRY,
): GroupRunner<ConsentedRawText> {
  let model: ConsentedPromptableModel | null = null;
  return {
    run: async (chunk, isCancelled) => {
      try {
        if (model === null) {
          const created = getModel();
          if (!created.ok) return created;
          model = created.value;
        }
        const ready = model;
        const { response } = await retryTransient(
          () => ready.generateContent(chunk),
          retry,
          isCancelled,
        );
        return ok({ text: response.text(), source: sourceOf(response.inferenceSource) });
      } catch (error) {
        return err(mapCloudAiError(error));
      }
    },
  };
}
