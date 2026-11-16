import { isUnmodifiedSample } from '../../domain/report/sampleReport';
import {
  unsafeCreateConsentedRawText,
  type ConsentedRawText,
  type RawText,
} from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';

/**
 * What the reporter agreed to, for ONE cloud scan (docs/design/fase3-product-plan.md §2b).
 * Never persisted: it lives in the flow state of the scan it was given for, and editing the
 * text after consent means a new consent.
 * - `sample`: one click, allowed only for the unmodified built-in fictional sample.
 * - `own-text`: the reporter read the risk explanation and ticked the checkbox.
 */
export type CloudScanConsent =
  { readonly kind: 'sample' } | { readonly kind: 'own-text'; readonly acknowledged: true };

export interface ConsentToCloudScanDeps {
  /** Remote Config kill switch `cloud_scan_enabled`, read just before the scan. */
  readonly cloudScanEnabled: boolean;
}

/** Fixed messages: never include report text. */
const DISABLED = createAppError('CloudScanDisabled', {
  message: 'The consented cloud scan is switched off (cloud_scan_enabled = false).',
});
const NO_CONSENT = createAppError('ConsentRequired', {
  message: 'No valid consent for this text; nothing was sent to the cloud.',
});
const EMPTY = createAppError('EmptyReport', { message: 'There is no text to scan.' });

/** Checked at runtime too: an untyped caller may pass anything, including nothing. */
function isValidConsent(text: RawText, consent: unknown): boolean {
  if (typeof consent !== 'object' || consent === null) return false;
  const { kind, acknowledged } = consent as { kind?: unknown; acknowledged?: unknown };
  if (kind === 'sample') return isUnmodifiedSample(text);
  return kind === 'own-text' && acknowledged === true;
}

/**
 * The ONLY place that creates ConsentedRawText (enforced by ESLint), i.e. the only way raw
 * text can become eligible for a cloud model. Refuses when the kill switch is off, when the
 * text is blank, when a `sample` consent is given for text that differs from the fictional
 * sample by even one character, and when an `own-text` consent was not acknowledged.
 */
export function consentToCloudScan(
  text: RawText,
  consent: CloudScanConsent,
  deps: ConsentToCloudScanDeps,
): Result<ConsentedRawText, AppError> {
  if (!deps.cloudScanEnabled) return err(DISABLED);
  if (text.trim() === '') return err(EMPTY);
  if (!isValidConsent(text, consent)) return err(NO_CONSENT);
  return ok(unsafeCreateConsentedRawText(text));
}
