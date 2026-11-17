import type { TextSpan } from '../types';

/**
 * Layer 2 of the on-device detection cascade: short spans that are likely to be the WRITER's
 * self-disclosures (role, schedule, place, personal dates, traits, team size). Candidates
 * carry no category; a later on-device verifier classifies them. Raw report text: never log.
 */

/** The grammatical pattern that produced a candidate, in cap priority order (first wins). */
export const CANDIDATE_KINDS = [
  'CLOSING_LINE',
  'TEMPORAL_CLAUSE',
  'POSSESSIVE_PHRASE',
  'TIME_EXPRESSION',
  'FIRST_PERSON_CLAUSE',
  'PLACE_PHRASE',
] as const;

export type CandidateKind = (typeof CANDIDATE_KINDS)[number];

/** What a pattern extractor proposes: a rough span in whole-report offsets. */
export interface RawCandidate {
  readonly span: TextSpan;
  readonly kind: CandidateKind;
}

/** A finished candidate: an exact, trimmed slice of the report text. */
export interface Candidate {
  readonly span: TextSpan;
  /** `text.slice(span.start, span.end)`. Raw report text: never log it. */
  readonly quote: string;
}

export const MIN_CANDIDATE_WORDS = 2;
export const MAX_CANDIDATE_WORDS = 12;
/** At most this many candidates per CANDIDATE_WINDOW_CHARS of report text. */
export const MAX_CANDIDATES = 25;
export const CANDIDATE_WINDOW_CHARS = 3000;

export function kindPriority(kind: CandidateKind): number {
  return CANDIDATE_KINDS.indexOf(kind);
}
