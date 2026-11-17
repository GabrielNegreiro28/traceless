import type { CandidateVerdict } from '../../domain/detection/candidates/verifiedFindings';
import type { RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';
import type { InferenceSourceKind } from './IdentityScanner';

export type { CandidateVerdict };

export interface CandidateVerification {
  /** One verdict per judged candidate; empty when the model output stayed invalid. */
  readonly verdicts: CandidateVerdict[];
  readonly source: InferenceSourceKind;
  /** Retries spent on invalid model output for this chunk. */
  readonly retries: number;
}

/**
 * Layer 3a of the on-device detection cascade: judges, for ONE chunk of raw report text,
 * which of the given candidate phrases (exact slices of that chunk, Layer 2) tell something
 * about the writer, and in which category. Verdict indexes refer to `candidates`.
 * Implementations must run on the device only (RAW text).
 */
export interface CandidateVerifier {
  verify(
    chunk: RawText,
    candidates: readonly string[],
  ): Promise<Result<CandidateVerification, AppError>>;
}
