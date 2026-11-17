import type { Candidate } from '../../domain/detection/candidates/candidateTypes';
import type { RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';

export type { Candidate };

/**
 * Layer 2 of the on-device detection cascade: proposes short spans of the whole report that
 * are likely the writer's self-disclosures. Deterministic, runs on the device, never calls a
 * model or the network. Candidates are raw report text: never log, persist or send them.
 */
export interface DisclosureCandidateFinder {
  find(text: RawText): Promise<Result<Candidate[], AppError>>;
}
