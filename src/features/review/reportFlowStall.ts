import { remainingRisk } from '../../domain/review/reviewState';
import type { Finding } from '../../domain/detection/types';
import type { ComposingState, ErrorState, FlowState, ReviewingState } from './reportFlowTypes';

/**
 * Stuck recovery in the reporter's flow (docs/design/fase2-gate-iteration.md §G.2), pure.
 * A stalled scan returns to the composer through an error, so the text is always kept.
 */

/** An OnDeviceStuck error over the composer (the scan that stalled). */
export type StallState = ErrorState & {
  readonly error: Extract<ErrorState['error'], { kind: 'OnDeviceStuck' }>;
  readonly previous: ComposingState;
};

export function isStall(state: FlowState): state is StallState {
  return (
    state.status === 'error' &&
    state.error.kind === 'OnDeviceStuck' &&
    state.previous.status === 'composing'
  );
}

/** "On-device AI stalled. Try again": the model was replaced, so a new scan can work. */
export function isRecoverableStall(state: FlowState): state is StallState {
  return isStall(state) && state.error.recoverable;
}

/** No more on-device tries this page load: basic checks or copy-and-reload. */
export function isTerminalStall(state: FlowState): state is StallState {
  return isStall(state) && !state.error.recoverable;
}

/** The review after "Continue with basic checks": rule findings only, flagged as basic. */
export function basicChecksReview(state: StallState, findings: readonly Finding[]): ReviewingState {
  return {
    status: 'reviewing',
    text: state.previous.text,
    checks: 'basic',
    findings,
    protectedSpans: [],
    decisions: [],
    risk: remainingRisk(findings, []),
  };
}
