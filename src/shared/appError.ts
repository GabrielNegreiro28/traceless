/**
 * Application-level error taxonomy (PLANO §1.6).
 * Adapters map SDK/browser exceptions to an AppError; the UI maps the `kind`
 * to a friendly message. `message` is developer-facing and must never contain
 * raw report text.
 */
type BaseError<K extends string> = {
  readonly kind: K;
  readonly message: string;
  readonly cause?: unknown;
};

export type AppError =
  | BaseError<'OnDeviceUnavailable'>
  | (BaseError<'LanguageNotSupported'> & { readonly language: string })
  | (BaseError<'ModelDownloading'> & { readonly progress: number | null })
  | BaseError<'InvalidModelOutput'>
  | BaseError<'Offline'>
  | BaseError<'QuotaExceeded'>
  | BaseError<'PermissionDenied'>
  /** A raw-text inference did not run on this device; its result was discarded. */
  | BaseError<'PrivacyViolation'>
  /**
   * An on-device inference outlived its deadline (docs/design/fase2-gate-iteration.md §G.2).
   * `recoverable`: its model was abandoned and the work settled, so trying again runs on a
   * fresh model; false once the page load's recoveries are spent or the abandoned work never
   * settled (then every later call fails fast until the page is reloaded).
   */
  | (BaseError<'OnDeviceStuck'> & { readonly recoverable: boolean })
  /** The input is larger than the on-device model accepts (Prompt API QuotaExceededError). */
  | BaseError<'InputTooLong'>
  | (BaseError<'Misconfigured'> & { readonly missing: readonly string[] })
  /** Approval refused: deterministic rules still find direct identifiers (count only, no text). */
  | (BaseError<'DirectIdentifierRemains'> & { readonly count: number })
  /** Approval refused: remaining risk needs an acknowledgement the reporter did not give. */
  | (BaseError<'RiskNotAcknowledged'> & {
      readonly level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
    })
  /** Approval refused: the rewritten report has no text left. */
  | BaseError<'EmptyReport'>
  /** The approved text differs from the preview the reporter saw; the approval was discarded. */
  | BaseError<'ApprovalMismatch'>
  /** The caller stopped the work (for example the reporter cancelled a scan). Not a failure. */
  | BaseError<'Cancelled'>
  /** The cloud model's safety filters refused the text; nothing was kept. */
  | BaseError<'ContentBlocked'>
  /** The consented cloud scan is switched off (Remote Config kill switch `cloud_scan_enabled`). */
  | BaseError<'CloudScanDisabled'>
  /** A cloud scan was asked for without a valid, explicit consent for this exact text. */
  | BaseError<'ConsentRequired'>
  | BaseError<'Unknown'>;

export type AppErrorKind = AppError['kind'];

export const APP_ERROR_KINDS: readonly AppErrorKind[] = [
  'OnDeviceUnavailable',
  'LanguageNotSupported',
  'ModelDownloading',
  'InvalidModelOutput',
  'Offline',
  'QuotaExceeded',
  'PermissionDenied',
  'PrivacyViolation',
  'OnDeviceStuck',
  'InputTooLong',
  'Misconfigured',
  'DirectIdentifierRemains',
  'RiskNotAcknowledged',
  'EmptyReport',
  'ApprovalMismatch',
  'Cancelled',
  'ContentBlocked',
  'CloudScanDisabled',
  'ConsentRequired',
  'Unknown',
];

type ErrorOf<K extends AppErrorKind> = Extract<AppError, { kind: K }>;
type ErrorFields<K extends AppErrorKind> = Omit<ErrorOf<K>, 'kind'>;

/** Builds a typed AppError; variant-specific fields are required by the type. */
export function createAppError<K extends AppErrorKind>(
  kind: K,
  fields: ErrorFields<K>,
): ErrorOf<K> {
  return { kind, ...fields } as ErrorOf<K>;
}

/** Runtime guard, useful at boundaries where an unknown value is caught. */
export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, message } = value as { kind?: unknown; message?: unknown };
  return (
    typeof message === 'string' &&
    typeof kind === 'string' &&
    (APP_ERROR_KINDS as readonly string[]).includes(kind)
  );
}
