import type { CandidateVerifier } from './CandidateVerifier';
import type { DisclosureCandidateFinder } from './DisclosureCandidates';

/** Layers 2 + 3a bound together: the candidate finder and the on-device verifier. */
export interface DisclosureVerification {
  readonly finder: DisclosureCandidateFinder;
  readonly verifier: CandidateVerifier;
}
