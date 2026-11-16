/**
 * Where a case stands (PLANO §3.5). Reporters only ever create `received`; a handler moves it
 * forward. firebase/firestore.rules lists the same values (a test keeps them in sync).
 */
export const CASE_STATUSES = ['received', 'acknowledged', 'feedbackGiven', 'closed'] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Order of progress: a later status implies every earlier step is done. */
export function caseStatusRank(status: CaseStatus): number {
  return CASE_STATUSES.indexOf(status);
}

export function isCaseStatus(value: unknown): value is CaseStatus {
  return typeof value === 'string' && (CASE_STATUSES as readonly string[]).includes(value);
}

/** Longest sanitized report the organization accepts (the Firestore rules enforce the same). */
export const MAX_SUBMITTED_CHARS = 6000;
