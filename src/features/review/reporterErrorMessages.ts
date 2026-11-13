import type { AppErrorKind } from '../../shared/appError';

/**
 * Calm, second-person copy for the reporter, one message per error kind. Distinct from the
 * developer evaluation tool's messages. Never includes report text or error details.
 */
const MESSAGES: Readonly<Record<AppErrorKind, string>> = {
  OnDeviceUnavailable:
    'The on-device AI could not start on this computer, so the check could not run privately. Nothing was sent anywhere. Try again, or reload this page.',
  LanguageNotSupported:
    'The on-device AI could not read this language. Traceless works in English only for now.',
  ModelDownloading:
    'The private AI is still being downloaded to this computer. Wait for it to finish, then try again. Nothing was sent anywhere.',
  InvalidModelOutput:
    'The on-device AI gave an answer Traceless could not read. Nothing was sent anywhere. Please try again.',
  Offline: "You appear to be offline. Your report hasn't gone anywhere. Reconnect and try again.",
  QuotaExceeded: 'A usage limit was reached. Please wait a little while and try again.',
  PermissionDenied:
    'Your browser did not allow the check to start. Select the button again, and make sure you are using Chrome on a computer.',
  PrivacyViolation:
    'Traceless stopped because part of the check did not run on this computer. Nothing was kept or sent.',
  OnDeviceStuck:
    'The on-device AI stopped responding. Nothing was sent anywhere. Try again, or copy your text and reload this page.',
  InputTooLong:
    'Your report is longer than the on-device AI can read in one go. Try shortening it.',
  Misconfigured: 'Traceless is not set up correctly right now. Please try again later.',
  DirectIdentifierRemains:
    'The report still contains a direct identifier, such as an email address or phone number.',
  RiskNotAcknowledged: 'The report still carries identifying details you have not decided on yet.',
  EmptyReport: 'There is no text left in the report.',
  ApprovalMismatch:
    'The approved text did not match the text you were shown, so it was not approved. Nothing was sent anywhere.',
  Cancelled: 'The check was stopped. Nothing was sent anywhere.',
  Unknown: 'Something went wrong. Nothing was sent anywhere. Please try again.',
};

export function reporterErrorMessage(kind: AppErrorKind): string {
  return MESSAGES[kind];
}
