import type { Finding, TextSpan } from '../../domain/detection/types';
import { isDecided, type ReviewDecision } from '../../domain/rewrite/reviewDecision';
import type { RiskAssessment } from '../../domain/risk/riskScorer';
import { CATEGORY_LABELS, riskText } from '../../ui';

/** Pure helpers behind the review screen (no React). */

/**
 * How a finding currently stands, from the reporter's point of view. `covered` is a finding
 * that disappears inside a wider accepted/edited change (it has no actions of its own).
 */
export type FindingState = 'pending' | 'accepted' | 'edited' | 'kept' | 'notAboutMe' | 'covered';

export const STATE_LABELS: Readonly<Record<FindingState, string>> = {
  pending: 'Undecided',
  accepted: 'Accepted',
  edited: 'Edited',
  kept: 'Kept anyway',
  notAboutMe: 'Not about me',
  covered: 'Removed by an overlapping change',
};

const STATE_BY_ACTION = {
  ACCEPTED: 'accepted',
  EDITED: 'edited',
  KEPT_RISK: 'kept',
  NOT_ABOUT_ME: 'notAboutMe',
} as const;

/** The state a decision alone implies (ignores overlaps; see reviewSnapshot). */
export function stateOf(decision: ReviewDecision | undefined): FindingState {
  if (decision === undefined || !isDecided(decision) || decision.action === 'PENDING_BY_USER') {
    return 'pending';
  }
  return STATE_BY_ACTION[decision.action];
}

export function decisionsById(
  decisions: readonly ReviewDecision[],
): ReadonlyMap<string, ReviewDecision> {
  return new Map(decisions.map((d) => [d.findingId, d]));
}

/** Findings in reading order, so cards follow the text. */
export function inReadingOrder(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => a.span.start - b.span.start || a.span.end - b.span.end || a.id.localeCompare(b.id),
  );
}

/** How many other findings received this finding's decision because their quote is identical. */
export function identicalCount(decisions: readonly ReviewDecision[], findingId: string): number {
  return decisions.filter((d) => d.propagatedFrom === findingId).length;
}

/** Shown whenever no finding is left; never worded as "no risk" (the check can miss things). */
export const NO_DETAILS_FLAGGED =
  'No details flagged — the check can miss things; read it once more.';

/** "Biggest contributors: unique role, location." from the live risk drivers. */
export function driversSentence(risk: RiskAssessment): string {
  if (risk.drivers.length === 0) return NO_DETAILS_FLAGGED;
  const top = [...risk.drivers]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((d) => CATEGORY_LABELS[d.category].toLowerCase());
  return `Biggest contributors: ${top.join(', ')}.`;
}

export function leftText(count: number): string {
  return count === 0 ? 'None left' : `${String(count)} left`;
}

/** The polite live-region message after a change, e.g. "Accepted. Risk: medium. 3 left." */
export function announcement(label: string, risk: RiskAssessment, left: number): string {
  return `${label}. ${riskText(risk.level)}. ${leftText(left)}.`;
}

/** What to select when a mark is activated: the next covering finding if one is selected. */
export function pickTarget(ids: readonly string[], selectedId: string | null): string | undefined {
  const at = selectedId === null ? -1 : ids.indexOf(selectedId);
  return at === -1 ? ids[0] : ids[(at + 1) % ids.length];
}

/** The distinct strings behind the protected spans, in the order they first appear. */
export function protectedQuotes(text: string, spans: readonly TextSpan[]): string[] {
  const quotes = [...spans]
    .sort((a, b) => a.start - b.start)
    .map((s) => text.slice(s.start, s.end).trim())
    .filter((quote) => quote !== '');
  return [...new Set(quotes)];
}

/** "(removed)" for a blank replacement, as the applier treats it. */
export function replacementLabel(replacement: string): string {
  return replacement.trim() === '' ? '(removed)' : replacement;
}

/** "1 detail" / "3 details". */
export function detailsText(count: number): string {
  return `${String(count)} ${count === 1 ? 'detail' : 'details'}`;
}
