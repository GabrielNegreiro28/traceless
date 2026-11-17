import { spanContains, spanLength } from '../span';
import { kindPriority, type CandidateKind, type RawCandidate } from './candidateTypes';

/** A container this close in length to a contained candidate says nothing new. */
export const NEAR_DUPLICATE_RATIO = 0.75;

function betterKind(a: CandidateKind, b: CandidateKind): CandidateKind {
  return kindPriority(a) <= kindPriority(b) ? a : b;
}

function byLengthThenPosition(a: RawCandidate, b: RawCandidate): number {
  return (
    spanLength(a.span) - spanLength(b.span) ||
    a.span.start - b.span.start ||
    kindPriority(a.kind) - kindPriority(b.kind)
  );
}

function isNearDuplicateOf(longer: RawCandidate, shorter: RawCandidate): boolean {
  if (!spanContains(longer.span, shorter.span)) return false;
  return spanLength(shorter.span) / spanLength(longer.span) >= NEAR_DUPLICATE_RATIO;
}

/**
 * Removes exact duplicates and near-duplicates: when a candidate contains a kept one that
 * covers most of it, the shorter one stays and takes the better (higher priority) kind.
 * Deterministic: the result is ordered by length, then position.
 */
export function dedupeCandidates(candidates: readonly RawCandidate[]): RawCandidate[] {
  const kept: RawCandidate[] = [];
  for (const candidate of [...candidates].sort(byLengthThenPosition)) {
    const index = kept.findIndex((k) => isNearDuplicateOf(candidate, k));
    const match = kept[index];
    if (match === undefined) kept.push(candidate);
    else kept[index] = { span: match.span, kind: betterKind(match.kind, candidate.kind) };
  }
  return kept;
}
