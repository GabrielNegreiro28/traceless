import { remainingRisk } from '../../domain/review/reviewState';
import type {
  ComposingState,
  ErrorState,
  FlowEvent,
  FlowState,
  NeedsConsentState,
  ScanningState,
} from './reportFlowTypes';
import { toReviewing } from './reportFlowReview';
import { basicChecksReview, isTerminalStall } from './reportFlowStall';
import { composing, toError } from './reportFlowTypes';

/** Transitions before review: writing, scanning, consent and error recovery (pure). */

export function startScan(text: ComposingState['text'], scanId: string): ScanningState {
  return { status: 'scanning', text, mode: 'onDevice', scanId, progress: null };
}

/** A scan id must be a non-empty string; a missing one (untyped caller) never matches. */
export function hasScanId(scanId: unknown): scanId is string {
  return typeof scanId === 'string' && scanId !== '';
}

/**
 * Scan events carry the id of their scan; a late event from an older scan is stale, and
 * so is an event with a missing or empty id (it can never belong to the current scan).
 */
function isStale(state: ScanningState, event: FlowEvent): boolean {
  if (!('scanId' in event)) return false;
  return !hasScanId(event.scanId) || event.scanId !== state.scanId;
}

function isValidProgress(done: number, total: number): boolean {
  return (
    Number.isInteger(done) && Number.isInteger(total) && total > 0 && done >= 0 && done <= total
  );
}

export function onComposing(state: ComposingState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'EDIT_TEXT':
      return event.text === state.text ? state : composing(event.text);
    case 'START_SCAN':
      return state.text.trim() === '' || !hasScanId(event.scanId)
        ? state
        : startScan(state.text, event.scanId);
    case 'CONSENT_REQUIRED':
      return { status: 'needsConsent', text: state.text };
    case 'PREPARE_REQUIRED':
      return { status: 'needsPrepare', text: state.text, progress: null };
    default:
      return state;
  }
}

/** Only composing can ask for consent or preparation (the device is checked before a scan). */
export function onScanning(state: ScanningState, event: FlowEvent): FlowState {
  if (isStale(state, event)) return state;
  switch (event.type) {
    case 'SCAN_PROGRESS':
      if (!isValidProgress(event.done, event.total)) return state;
      return { ...state, progress: { done: event.done, total: event.total } };
    case 'SCAN_DONE': {
      const { findings, protectedSpans = [] } = event;
      const risk = remainingRisk(findings, []);
      return {
        status: 'reviewing',
        text: state.text,
        checks: 'full',
        findings,
        protectedSpans,
        decisions: [],
        risk,
      };
    }
    case 'SCAN_FAILED':
      return toError(event.error, composing(state.text));
    case 'CANCEL_SCAN':
      return composing(state.text);
    default:
      return state;
  }
}

/** START_SCAN here means the reporter chose a scan path (consented cloud or rules only). */
export function onNeedsConsent(state: NeedsConsentState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'START_SCAN':
      return hasScanId(event.scanId) ? startScan(state.text, event.scanId) : state;
    case 'BACK_TO_EDIT':
      return composing(state.text);
    default:
      return state;
  }
}

/**
 * BACK_TO_EDIT dismisses the error and returns to the state it interrupted. BACK_TO_REVIEW
 * goes one step further for an approval refused in the outbox (the fix is in the review).
 * BASIC_CHECKS_DONE opens a rules-only review, only after a terminal on-device stall.
 */
export function onError(state: ErrorState, event: FlowEvent): FlowState {
  if (event.type === 'BACK_TO_EDIT') return state.previous;
  if (event.type === 'BACK_TO_REVIEW' && state.previous.status === 'outbox') {
    return toReviewing(state.previous);
  }
  if (event.type === 'BASIC_CHECKS_DONE' && isTerminalStall(state)) {
    return basicChecksReview(state, event.findings);
  }
  return state;
}
