import { capCandidates } from './capCandidates';
import type { Candidate, RawCandidate } from './candidateTypes';
import { dedupeCandidates } from './dedupeCandidates';
import { trimCandidateSpan } from './trimCandidate';

function isInside(text: string, candidate: RawCandidate): boolean {
  const { start, end } = candidate.span;
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    0 <= start &&
    start < end &&
    end <= text.length
  );
}

function trimAll(text: string, candidates: readonly RawCandidate[]): RawCandidate[] {
  return candidates
    .filter((c) => isInside(text, c))
    .flatMap((c) => {
      const span = trimCandidateSpan(text, c.span);
      return span === null ? [] : [{ span, kind: c.kind }];
    });
}

/**
 * Turns rough pattern proposals into final candidates: exact slices of `text`, trimmed to
 * 2–12 words, de-duplicated, capped per window and ordered by position. Pure and
 * deterministic: the same proposals in any order give the same result.
 */
export function finalizeCandidates(text: string, candidates: readonly RawCandidate[]): Candidate[] {
  return capCandidates(dedupeCandidates(trimAll(text, candidates)))
    .sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end)
    .map(({ span }) => ({ span, quote: text.slice(span.start, span.end) }));
}
