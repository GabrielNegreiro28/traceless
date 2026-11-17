import type { SourceVariant } from '../../ui';
import type { FlowState, ScanChecks } from './reportFlowTypes';

/**
 * Where the text was checked, as the reporter sees it (design plan §4: green lock = on-device,
 * slate-blue cloud = cloud, neutral ruler = no AI). Always derived from the scan that produced
 * the review (`checks`, set from the scan mode) and from whether the app runs the demo
 * scanner, never hardcoded. The demo scanner is never presented as AI.
 */

export interface SourceLabel {
  readonly variant: SourceVariant;
  readonly label: string;
}

/** The badge for the whole check (review header, approved screen). */
export function checkedBadge(checks: ScanChecks, demo: boolean): SourceLabel {
  if (checks === 'basic') return { variant: 'rules', label: 'Basic private check (patterns only)' };
  if (demo) return { variant: 'rules', label: 'Checked by the demo scanner (no AI)' };
  return checks === 'cloud'
    ? { variant: 'cloud', label: 'Checked in the cloud, with your consent' }
    : { variant: 'onDevice', label: 'Checked on your device' };
}

/** The origin label of a model finding (a rule finding always reads "Pattern rule"). */
export function modelFindingBadge(checks: ScanChecks, demo: boolean): SourceLabel {
  if (demo) return { variant: 'rules', label: 'Demo scanner' };
  if (checks === 'basic') return { variant: 'rules', label: 'Pattern rule' };
  return checks === 'cloud'
    ? { variant: 'cloud', label: 'Cloud AI' }
    : { variant: 'onDevice', label: 'On-device AI' };
}

/**
 * Cloud mode lasts from the consented scan until the end of the flow: while it scans, and
 * on every screen of the review it produced.
 */
export function isCloudMode(state: FlowState): boolean {
  switch (state.status) {
    case 'scanning':
      return state.mode === 'consentedCloud';
    case 'reviewing':
    case 'outbox':
    case 'approved':
    case 'submitting':
      return state.checks === 'cloud';
    default:
      return false;
  }
}
