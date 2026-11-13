import { onComposing, onError, onNeedsConsent, onScanning } from './reportFlowCompose';
import { onNeedsPrepare } from './reportFlowPrepare';
import { onApproved, onOutbox, onReviewing, onSubmitting } from './reportFlowReview';
import { INITIAL_FLOW_STATE, type FlowEvent, type FlowState } from './reportFlowTypes';

export * from './reportFlowTypes';

/** Unreachable by type; reports only the status, never the state (it holds raw text). */
function assertNever(value: never): never {
  const { status } = value as { readonly status: unknown };
  throw new Error(`Unhandled report flow state: ${String(status)}`);
}

/**
 * Pure reducer of the reporter's flow (PLANO §3.6):
 * composing → scanning → reviewing → outbox → approved → submitting → submitted, plus
 * needsConsent, needsPrepare and error(previous). RESET always returns to an empty composer. Any event
 * a state does not accept returns that same state object, so invalid transitions are
 * no-ops; the exhaustive switch makes a forgotten state a compile error.
 */
export function reportFlowReducer(state: FlowState, event: FlowEvent): FlowState {
  if (event.type === 'RESET') return INITIAL_FLOW_STATE;
  switch (state.status) {
    case 'composing':
      return onComposing(state, event);
    case 'scanning':
      return onScanning(state, event);
    case 'needsConsent':
      return onNeedsConsent(state, event);
    case 'needsPrepare':
      return onNeedsPrepare(state, event);
    case 'reviewing':
      return onReviewing(state, event);
    case 'approved':
      return onApproved(state, event);
    case 'outbox':
      return onOutbox(state, event);
    case 'submitting':
      return onSubmitting(state, event);
    case 'submitted':
      return state;
    case 'error':
      return onError(state, event);
    default:
      return assertNever(state);
  }
}
