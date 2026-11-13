import { remainingRisk } from '../../domain/review/reviewState';
import type {
  ComposingState,
  ErrorState,
  FlowEvent,
  FlowState,
  NeedsConsentState,
  ScanningState,
} from './reportFlowTypes';
import { composing, toError } from './reportFlowTypes';

/** Transitions before review: writing, scanning, consent and error recovery (pure). */

function startScan(text: ComposingState['text'], scanId: string): ScanningState {
  return { status: 'scanning', text, scanId, progress: null };
}

/** Scan events carry the id of their scan; a late event from an older scan is stale. */
function isStale(state: ScanningState, event: FlowEvent): boolean {
  return 'scanId' in event && event.scanId !== state.scanId;
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
      return state.text.trim() === '' ? state : startScan(state.text, event.scanId);
    case 'CONSENT_REQUIRED':
      return { status: 'needsConsent', text: state.text };
    default:
      return state;
  }
}

export function onScanning(state: ScanningState, event: FlowEvent): FlowState {
  if (isStale(state, event)) return state;
  switch (event.type) {
    case 'SCAN_PROGRESS':
      if (!isValidProgress(event.done, event.total)) return state;
      return { ...state, progress: { done: event.done, total: event.total } };
    case 'SCAN_DONE': {
      const { findings } = event;
      const risk = remainingRisk(findings, []);
      return { status: 'reviewing', text: state.text, findings, decisions: [], risk };
    }
    case 'SCAN_FAILED':
      return toError(event.error, composing(state.text));
    case 'CONSENT_REQUIRED':
      return { status: 'needsConsent', text: state.text };
    default:
      return state;
  }
}

/** START_SCAN here means the reporter chose a scan path (consented cloud or rules only). */
export function onNeedsConsent(state: NeedsConsentState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'START_SCAN':
      return startScan(state.text, event.scanId);
    case 'BACK_TO_EDIT':
      return composing(state.text);
    default:
      return state;
  }
}

/** BACK_TO_EDIT dismisses the error and returns to the state it interrupted. */
export function onError(state: ErrorState, event: FlowEvent): FlowState {
  return event.type === 'BACK_TO_EDIT' ? state.previous : state;
}
