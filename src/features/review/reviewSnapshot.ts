import type { Finding } from '../../domain/detection/types';
import { previewClusters, type RewritePreview } from '../../domain/rewrite/previewClusters';
import type { ReviewDecision } from '../../domain/rewrite/reviewDecision';
import { decisionsById, stateOf, type FindingState } from './reviewModel';

/** Everything the review screen shows about the current decisions, derived in one place. */
export interface ReviewSnapshot {
  readonly decisionMap: ReadonlyMap<string, ReviewDecision>;
  /** What the rewrite will do (the same clusters the applier uses). */
  readonly preview: RewritePreview;
  readonly states: ReadonlyMap<string, FindingState>;
  /** Ids of the findings that still need a decision, in reading order. */
  readonly pending: readonly string[];
}

/** A covered finding is gone from the rewritten text, so it is never "undecided". */
export function snapshotOf(
  text: string,
  ordered: readonly Finding[],
  decisions: readonly ReviewDecision[],
): ReviewSnapshot {
  const decisionMap = decisionsById(decisions);
  const preview = previewClusters(text, ordered, decisions);
  const states = new Map<string, FindingState>(
    ordered.map((f) => [
      f.id,
      preview.covered.has(f.id) ? 'covered' : stateOf(decisionMap.get(f.id)),
    ]),
  );
  const pending = ordered.filter((f) => states.get(f.id) === 'pending').map((f) => f.id);
  return { decisionMap, preview, states, pending };
}

/** The first pending finding after `fromId` (wrapping around), or null when none is left. */
export function nextPendingId(
  ordered: readonly Finding[],
  pending: readonly string[],
  fromId: string | null,
): string | null {
  const open = new Set(pending);
  const from = ordered.findIndex((f) => f.id === fromId);
  for (let step = 1; step <= ordered.length; step++) {
    const candidate = ordered[(from + step + ordered.length) % ordered.length];
    if (candidate !== undefined && open.has(candidate.id)) return candidate.id;
  }
  return null;
}
