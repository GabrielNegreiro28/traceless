import { useCallback, type Dispatch, type RefObject } from 'react';
import { useServices } from '../../app/services/useServices';
import type { FlowEvent, FlowState } from './reportFlowMachine';
import { isRecoverableStall, isTerminalStall } from './reportFlowStall';

/** The reporter's ways out of a stalled on-device scan (docs/design/fase2-gate-iteration.md §G.2). */
export interface StallActions {
  /** Recoverable stall: back to the kept text, then the same device check and scan. */
  readonly retryScan: () => void;
  /** Terminal stall: pattern rules only (never a model), then the review marked as basic. */
  readonly continueWithBasicChecks: () => void;
}

/**
 * `latest` is the current flow state; `checkAndScan` is the device check that routes to a
 * scan (as "Check my report" does). Nothing here retries on its own: every action is a click.
 */
export function useStallRecovery(
  latest: RefObject<FlowState>,
  dispatch: Dispatch<FlowEvent>,
  checkAndScan: () => void,
): StallActions {
  const { scanRulesOnly } = useServices();

  const retryScan = useCallback(() => {
    if (!isRecoverableStall(latest.current)) return;
    dispatch({ type: 'BACK_TO_EDIT' });
    checkAndScan();
  }, [latest, dispatch, checkAndScan]);

  const continueWithBasicChecks = useCallback(() => {
    const state = latest.current;
    if (!isTerminalStall(state)) return;
    const { findings } = scanRulesOnly(state.previous.text);
    dispatch({ type: 'BASIC_CHECKS_DONE', findings });
  }, [latest, dispatch, scanRulesOnly]);

  return { retryScan, continueWithBasicChecks };
}
