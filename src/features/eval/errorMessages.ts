import type { AppError, AppErrorKind } from '../../shared/appError';

/** Plain-language text for the developer tool; never includes report text. */
export function friendlyKindMessage(kind: AppErrorKind): string {
  switch (kind) {
    case 'OnDeviceUnavailable':
      return 'On-device AI is not available in this browser. Use Chrome on a computer with the on-device AI flag enabled.';
    case 'LanguageNotSupported':
      return 'The on-device model does not support this language.';
    case 'ModelDownloading':
      return 'The on-device model is still downloading. Wait for it to finish, then try again.';
    case 'InvalidModelOutput':
      return 'The model answered in a format the app could not read.';
    case 'Offline':
      return 'The browser appears to be offline.';
    case 'QuotaExceeded':
      return 'A usage limit was reached. Try again later.';
    case 'PermissionDenied':
      return 'Chrome refused the request. Click a button on this page and try again.';
    case 'PrivacyViolation':
      return 'Stopped: a report did not run on this device. Nothing was kept.';
    case 'OnDeviceStuck':
      return 'On-device AI stalled on this report and timed out. If every later report fails too, reload this page.';
    case 'InputTooLong':
      return 'A report is longer than the on-device model accepts.';
    case 'Misconfigured':
      return 'The tool is not set up correctly.';
    case 'DirectIdentifierRemains':
      return 'The report still contains a direct identifier, such as an email or phone number.';
    case 'RiskNotAcknowledged':
      return 'The report still carries identifying details that were not acknowledged.';
    case 'EmptyReport':
      return 'The report is empty.';
    case 'ApprovalMismatch':
      return 'The approved text did not match the preview.';
    case 'Cancelled':
      return 'The run was cancelled.';
    case 'ContentBlocked':
      return 'The cloud model refused this report (safety filters).';
    case 'CloudScanDisabled':
      return 'The consented cloud scan is switched off (cloud_scan_enabled).';
    case 'ConsentRequired':
      return 'A cloud scan was requested without a valid consent.';
    case 'NotFound':
      return 'The requested record does not exist.';
    case 'SubmitUnconfirmed':
      return 'The send could not be confirmed; the report may have arrived.';
    case 'Unknown':
      return 'Something went wrong. Reload the page and try again.';
  }
}

export function friendlyErrorMessage(error: AppError): string {
  const base = friendlyKindMessage(error.kind);
  if (error.kind !== 'Misconfigured' || error.missing.length === 0) return base;
  return `${base.slice(0, -1)} (${error.missing.join(', ')}).`;
}
