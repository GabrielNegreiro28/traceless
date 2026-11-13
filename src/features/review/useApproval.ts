import { useCallback, type Dispatch } from 'react';
import { useServices } from '../../app/services/useServices';
import type { Services } from '../../app/compositionRoot';
import { createAppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import { err } from '../../shared/result';
import type { FlowEvent, FlowState, OutboxState } from './reportFlowTypes';

const CRASHED = createAppError('Unknown', { message: 'Approving the report failed.' });

/** The use case is pure, but a throw must still end as an error screen, never a crash. */
function runApproval(
  approveReport: Services['approveReport'],
  state: OutboxState,
  acknowledged: boolean,
): ReturnType<Services['approveReport']> {
  try {
    return approveReport({
      text: state.text,
      findings: state.findings,
      decisions: state.decisions,
      acknowledgedRemainingRisk: acknowledged,
    });
  } catch {
    return err(CRASHED);
  }
}

/**
 * The outbox's "Approve this text": runs approveReport (from the services, which also record
 * the privacy ledger) on the outbox review and dispatches the outcome. The reducer then checks
 * that the approved text is exactly the preview the reporter saw.
 */
export function useApproval(
  state: FlowState,
  dispatch: Dispatch<FlowEvent>,
): (acknowledged: boolean) => void {
  const { approveReport } = useServices();
  return useCallback(
    (acknowledged: boolean) => {
      if (state.status !== 'outbox') return;
      const result = runApproval(approveReport, state, acknowledged);
      if (result.ok) {
        dispatch({ type: 'APPROVE_OK', report: result.value });
        return;
      }
      logger.info('Approval refused', { kind: result.error.kind });
      dispatch({ type: 'APPROVE_FAILED', error: result.error });
    },
    [approveReport, dispatch, state],
  );
}
