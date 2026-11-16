import type { AppErrorKind } from '../../shared/appError';
import type { TimelineStepId } from '../../domain/case/caseTimeline';

/** Lookup errors: never echo the key the reporter typed. */
const LOOKUP_ERRORS: Partial<Record<AppErrorKind, string>> = {
  NotFound: "We couldn't find a case with that key. Check it and try again.",
  Offline: "You're offline. Reconnect and try again.",
  PermissionDenied: "The organization's server refused the request. Try again in a moment.",
  QuotaExceeded: 'Too many requests right now. Try again in a few minutes.',
};

export function lookupErrorMessage(kind: AppErrorKind): string {
  return LOOKUP_ERRORS[kind] ?? 'Something went wrong. Try again.';
}

export const STEP_LABELS: Readonly<Record<TimelineStepId, string>> = {
  received: 'Report received',
  acknowledged: 'Receipt acknowledged',
  feedbackGiven: 'Feedback on the follow-up',
};

const DATE_FORMAT = new Intl.DateTimeFormat('en', { dateStyle: 'long' });

export function formatDate(ms: number): string {
  return DATE_FORMAT.format(new Date(ms));
}
