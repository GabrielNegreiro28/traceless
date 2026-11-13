import { hasScanId, startScan } from './reportFlowCompose';
import type { FlowEvent, FlowState, NeedsPrepareState } from './reportFlowTypes';
import { composing, toError } from './reportFlowTypes';

/** Transitions of the one-time on-device model download step (pure). */

function isFraction(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/** START_SCAN here means the download finished and the scan can begin. */
export function onNeedsPrepare(state: NeedsPrepareState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'PREPARE_PROGRESS':
      return isFraction(event.fraction) ? { ...state, progress: event.fraction } : state;
    case 'PREPARE_FAILED':
      return toError(event.error, { ...state, progress: null });
    case 'START_SCAN':
      return hasScanId(event.scanId) ? startScan(state.text, event.scanId) : state;
    case 'BACK_TO_EDIT':
      return composing(state.text);
    default:
      return state;
  }
}
