import type { AppErrorKind } from '../../shared/appError';
import { reporterErrorMessage } from './reporterErrorMessages';

/**
 * Copy for a failed CONSENTED CLOUD scan. The on-device copy often says "nothing was sent
 * anywhere", which is not true once the reporter agreed to a cloud check, so every kind here
 * says only what is true: Traceless kept nothing. Never includes report text.
 */

const ALREADY_CLOUD_SPECIFIC: ReadonlySet<AppErrorKind> = new Set([
  'ContentBlocked',
  'CloudScanDisabled',
  'ConsentRequired',
]);

const CLOUD_MESSAGES: Partial<Record<AppErrorKind, string>> = {
  QuotaExceeded:
    'The cloud check has reached its usage limit for now. Traceless kept nothing. Try again later, or run the basic private check.',
  PermissionDenied:
    "The cloud service didn't accept the request from this page. Traceless kept nothing. Reload the page and try again, or run the basic private check.",
  Offline:
    "The cloud check couldn't reach the service or took too long. Traceless kept nothing. Check your connection and try again, or run the basic private check.",
  InvalidModelOutput:
    'The cloud AI gave an answer Traceless could not read. Traceless kept nothing. Try again, or run the basic private check.',
  Cancelled: 'The cloud check was stopped. Traceless kept nothing.',
};

const CLOUD_FALLBACK =
  'The cloud check did not finish. Traceless kept nothing from it. Try again, or run the basic private check.';

export function cloudScanErrorMessage(kind: AppErrorKind): string {
  if (ALREADY_CLOUD_SPECIFIC.has(kind)) return reporterErrorMessage(kind);
  return CLOUD_MESSAGES[kind] ?? CLOUD_FALLBACK;
}
