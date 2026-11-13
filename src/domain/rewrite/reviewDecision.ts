/**
 * What the reporter chose to do with one finding during review (PLANO §3.4):
 * - ACCEPTED: use the suggestion (a null suggestion removes the span).
 * - EDITED: use the reporter's own replacement (blank removes the span).
 * - KEPT_RISK: keep the detail on purpose; it still counts toward the residual risk.
 * - NOT_ABOUT_ME: the detail does not describe the reporter (the model misjudged it);
 *   the text stays and the finding no longer counts toward risk.
 */
export type ChoiceAction = 'ACCEPTED' | 'EDITED' | 'KEPT_RISK' | 'NOT_ABOUT_ME';

/**
 * PENDING_BY_USER marks a finding the reporter cleared by undoing a propagated copy: it
 * behaves exactly like "no decision" (pending), but propagation never overrides it.
 */
export type ReviewAction = ChoiceAction | 'PENDING_BY_USER';

export interface ReviewChoice {
  readonly action: ChoiceAction;
  /** Required for EDITED; ignored otherwise. */
  readonly replacement?: string;
}

export interface ReviewDecision {
  readonly findingId: string;
  readonly action: ReviewAction;
  /** Required for EDITED; ignored otherwise. */
  readonly replacement?: string;
  /** Set when the decision was copied from an identical quote (see propagateDecision). */
  readonly propagatedFrom?: string;
}

/** ACCEPTED and EDITED change the text; every other action leaves it as written. */
export function changesText(decision: { readonly action: ReviewAction }): boolean {
  return decision.action === 'ACCEPTED' || decision.action === 'EDITED';
}

/** True for a decision that resolves the finding (anything but the pending marker). */
export function isDecided(decision: { readonly action: ReviewAction } | undefined): boolean {
  return decision !== undefined && decision.action !== 'PENDING_BY_USER';
}
