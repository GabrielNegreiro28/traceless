import type { FindingOrigin } from '../detection/types';
import { MUST_NOT_KINDS, type MustNotKind } from './datasetSchema';
import type { EvalFinding, MustNotCounts } from './evalTypes';
import { spansMatch } from './matching';
import type { ResolvedMustNot } from './resolveSpans';

function flaggedCount(spans: readonly ResolvedMustNot[], findings: readonly EvalFinding[]): number {
  return spans.filter((m) => findings.some((f) => spansMatch(f.span, m.span))).length;
}

export function emptyMustNot(): Record<MustNotKind, MustNotCounts> {
  return Object.fromEntries(
    MUST_NOT_KINDS.map((k) => [k, { total: 0, flagged: 0, flaggedBy: { RULE: 0, MODEL: 0 } }]),
  ) as Record<MustNotKind, MustNotCounts>;
}

/**
 * Must-not violations: `flagged` uses the merged findings; `flaggedBy.RULE` uses the
 * deterministic rule findings and `flaggedBy.MODEL` the pre-merge located model
 * findings, so merge order cannot bias origin attribution.
 */
export function mustNotTallies(
  mustNot: readonly ResolvedMustNot[],
  merged: readonly EvalFinding[],
  byOrigin: Readonly<Record<FindingOrigin, readonly EvalFinding[]>>,
): Record<MustNotKind, MustNotCounts> {
  const result = emptyMustNot();
  for (const kind of MUST_NOT_KINDS) {
    const spans = mustNot.filter((m) => m.kind === kind);
    result[kind] = {
      total: spans.length,
      flagged: flaggedCount(spans, merged),
      flaggedBy: {
        RULE: flaggedCount(spans, byOrigin.RULE),
        MODEL: flaggedCount(spans, byOrigin.MODEL),
      },
    };
  }
  return result;
}
