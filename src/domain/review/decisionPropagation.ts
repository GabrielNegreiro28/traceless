import { normalizeWithMap } from '../detection/spanLocator';
import type { Finding } from '../detection/types';
import type { ReviewChoice, ReviewDecision } from '../rewrite/reviewDecision';

/** Comparison key for "the same quote": case-insensitive, whitespace runs collapsed. */
function quoteKey(quote: string): string {
  return normalizeWithMap(quote).text.trim();
}

/** A decision the reporter made directly (not copied from an identical quote). */
function isExplicit(decision: ReviewDecision | undefined): boolean {
  return decision !== undefined && decision.propagatedFrom === undefined;
}

function toDecision(findingId: string, choice: ReviewChoice, from?: string): ReviewDecision {
  const { action, replacement } = choice;
  const decision: ReviewDecision =
    replacement === undefined ? { findingId, action } : { findingId, action, replacement };
  return from === undefined ? decision : { ...decision, propagatedFrom: from };
}

/** Ids of the other findings with an identical quote and no explicit decision. */
function siblingIds(
  findings: readonly Finding[],
  byId: ReadonlyMap<string, ReviewDecision>,
  target: Finding,
): string[] {
  const key = quoteKey(target.quote);
  return findings
    .filter((f) => f.id !== target.id && quoteKey(f.quote) === key)
    .filter((f) => !isExplicit(byId.get(f.id)))
    .map((f) => f.id);
}

/**
 * Records the reporter's choice for one finding and copies it to every other finding
 * whose quote is the same string (case-insensitive, whitespace-normalized) unless that
 * finding already has an explicit decision. "Not about me" on "Mr. Alvarez" therefore
 * dismisses every "Mr. Alvarez". Copies carry `propagatedFrom`, so a later choice on the
 * same target replaces them and `undoDecision` removes them. A PENDING_BY_USER marker
 * counts as explicit, so a copy the reporter undid is never re-applied. Unknown ids
 * change nothing.
 */
export function propagateDecision(
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
  findingId: string,
  choice: ReviewChoice,
): ReviewDecision[] {
  const target = findings.find((f) => f.id === findingId);
  if (!target) return [...decisions];
  const byId = new Map(decisions.map((d) => [d.findingId, d]));
  const siblings = siblingIds(findings, byId, target);
  const replaced = new Set([findingId, ...siblings]);
  return [
    ...decisions.filter((d) => !replaced.has(d.findingId)),
    toDecision(findingId, choice),
    ...siblings.map((id) => toDecision(id, choice, findingId)),
  ];
}

/**
 * Undoes the reporter's decision for `findingId`:
 * - an explicit decision is removed together with every copy made from it;
 * - a propagated copy becomes the PENDING_BY_USER marker, so the finding is pending again
 *   and a later choice on the source does not silently re-apply the copy.
 */
export function undoDecision(
  decisions: readonly ReviewDecision[],
  findingId: string,
): ReviewDecision[] {
  const target = decisions.find((d) => d.findingId === findingId);
  if (target?.propagatedFrom !== undefined) {
    const cleared: ReviewDecision = { findingId, action: 'PENDING_BY_USER' };
    return decisions.map((d) => (d.findingId === findingId ? cleared : d));
  }
  return decisions.filter((d) => d.findingId !== findingId && d.propagatedFrom !== findingId);
}
