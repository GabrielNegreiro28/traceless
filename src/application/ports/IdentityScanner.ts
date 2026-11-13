import type { ModelFinding } from '../../domain/detection/types';
import type { RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';

/** Where an inference actually ran (from the SDK's `inferenceSource`). */
export type InferenceSourceKind = 'ON_DEVICE' | 'IN_CLOUD';

export interface IdentityScanResult {
  /** Unlocated model findings for the scanned chunk (quotes, not offsets). */
  readonly findings: ModelFinding[];
  readonly source: InferenceSourceKind;
  /** Retries spent on invalid model output for this chunk. */
  readonly retries: number;
}

/**
 * Finds quasi-identifiers of the writer in ONE chunk of raw report text.
 * Implementations decide the prompt strategy; callers handle chunking and locating.
 */
export interface IdentityScanner {
  scan(chunk: RawText): Promise<Result<IdentityScanResult, AppError>>;
}
