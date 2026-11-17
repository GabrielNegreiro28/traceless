import {
  CANDIDATE_WINDOW_CHARS,
  kindPriority,
  MAX_CANDIDATES,
  type RawCandidate,
} from './candidateTypes';

function byPriorityThenPosition(a: RawCandidate, b: RawCandidate): number {
  return (
    kindPriority(a.kind) - kindPriority(b.kind) ||
    a.span.start - b.span.start ||
    a.span.end - b.span.end
  );
}

/**
 * Keeps at most MAX_CANDIDATES per CANDIDATE_WINDOW_CHARS window (a candidate belongs to the
 * window its start falls in), preferring higher-priority kinds, then earlier positions.
 */
export function capCandidates(candidates: readonly RawCandidate[]): RawCandidate[] {
  const windows = new Map<number, RawCandidate[]>();
  for (const candidate of candidates) {
    const window = Math.floor(candidate.span.start / CANDIDATE_WINDOW_CHARS);
    windows.set(window, [...(windows.get(window) ?? []), candidate]);
  }
  return [...windows.values()].flatMap((group) =>
    [...group].sort(byPriorityThenPosition).slice(0, MAX_CANDIDATES),
  );
}
