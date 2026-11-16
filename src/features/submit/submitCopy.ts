import type { AppErrorKind } from '../../shared/appError';

/**
 * Copy for a failed send. Honest: the report text is still in this tab, and these messages
 * never claim that nothing left the device (a consented cloud scan may have run earlier).
 * "Wasn't sent" is said only for certain failures; a send whose outcome is unknown (timeout,
 * failure after the commit started) is SubmitUnconfirmed and says it may have arrived.
 */
export const OFFLINE_SEND_MESSAGE = 'Your report stays in this tab. Reconnect to send.';

const MESSAGES: Partial<Record<AppErrorKind, string>> = {
  Offline: OFFLINE_SEND_MESSAGE,
  PermissionDenied:
    "The organization's server refused the report. Your report stays in this tab. Try again in a moment.",
  QuotaExceeded:
    'Too many reports are being sent right now. Your report stays in this tab. Try again in a few minutes.',
  Misconfigured:
    'Sending is not set up correctly right now. Your report stays in this tab. Please try again later.',
  InputTooLong:
    'The approved report is longer than 6,000 characters. Go back, shorten it and approve it again.',
  SubmitUnconfirmed: 'It may have reached the organization. Your text stays in this tab.',
};

const FALLBACK = "We couldn't send your report. It stays in this tab. Try again.";

export function submitErrorMessage(kind: AppErrorKind): string {
  return MESSAGES[kind] ?? FALLBACK;
}

export function submitErrorHeading(kind: AppErrorKind): string {
  if (kind === 'Offline') return "You're offline";
  if (kind === 'SubmitUnconfirmed') return "We couldn't confirm your report arrived";
  return "Your report wasn't sent";
}
