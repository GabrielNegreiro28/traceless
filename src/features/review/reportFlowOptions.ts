import type { CloudScanConsent } from '../../application/usecases/consentToCloudScan';
import type { Finding } from '../../domain/detection/types';
import { remainingRisk } from '../../domain/review/reviewState';
import type { RawText } from '../../domain/text/brandedText';
import { hasScanId, startScan } from './reportFlowCompose';
import type {
  FlowEvent,
  FlowState,
  NeedsConsentState,
  ReviewingState,
  ScanningState,
} from './reportFlowTypes';
import { composing } from './reportFlowTypes';

/**
 * The options when on-device AI is unavailable (design plan §2), pure: a consented cloud
 * scan, the basic private check (pattern rules only), or back to the text.
 */

/** A review of pattern-rule findings only, flagged as basic (no AI read the text). */
export function basicReview(text: RawText, findings: readonly Finding[]): ReviewingState {
  return {
    status: 'reviewing',
    text,
    checks: 'basic',
    findings,
    protectedSpans: [],
    decisions: [],
    risk: remainingRisk(findings, []),
  };
}

/** The scan the consent was given for: this text, this scan id, this consent only. */
export function startCloudScan(
  text: RawText,
  scanId: string,
  consent: CloudScanConsent,
): ScanningState {
  return { status: 'scanning', text, mode: 'consentedCloud', consent, scanId, progress: null };
}

/** The shape of a consent; the use case checks it again against the text it is used on. */
function isConsent(value: unknown): value is CloudScanConsent {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, acknowledged } = value as { kind?: unknown; acknowledged?: unknown };
  return kind === 'sample' || (kind === 'own-text' && acknowledged === true);
}

/**
 * START_CLOUD_SCAN needs a scan id and a consent; START_SCAN (an on-device scan) is kept for
 * a device that became ready; BASIC_CHECKS_DONE opens the basic review.
 */
export function onNeedsConsent(state: NeedsConsentState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'START_SCAN':
      return hasScanId(event.scanId) ? startScan(state.text, event.scanId) : state;
    case 'START_CLOUD_SCAN':
      return hasScanId(event.scanId) && isConsent(event.consent)
        ? startCloudScan(state.text, event.scanId, event.consent)
        : state;
    case 'BASIC_CHECKS_DONE':
      return basicReview(state.text, event.findings);
    case 'BACK_TO_EDIT':
      return composing(state.text);
    default:
      return state;
  }
}
