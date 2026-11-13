import { useEffect, type Dispatch } from 'react';
import type { ProgressCallback, Services } from '../../app/compositionRoot';
import type { RawText } from '../../domain/text/brandedText';
import { createAppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import type { FlowEvent, FlowState } from './reportFlowMachine';

type ScanOutcome = Awaited<ReturnType<Services['scanReport']>>;

function outcomeEvent(scanId: string, outcome: ScanOutcome): FlowEvent {
  if (outcome.ok) return { type: 'SCAN_DONE', scanId, findings: outcome.value.findings };
  return { type: 'SCAN_FAILED', scanId, error: outcome.error };
}

/** The scan use case never throws, but a defect must not leave the screen scanning forever. */
function failureEvent(scanId: string): FlowEvent {
  logger.error('Scan threw', { kind: 'Unknown' });
  return {
    type: 'SCAN_FAILED',
    scanId,
    error: createAppError('Unknown', { message: 'The scan failed unexpectedly.' }),
  };
}

/**
 * Runs the scan for one scanId and reports events only while `isActive()` holds. The same
 * predicate (inverted) is the scan's cancellation check, so a cancelled, superseded or
 * unmounted scan stops before its next chunk and never dispatches. The reducer also
 * ignores stale ids, so this is defense in depth.
 */
async function runScan(
  scanReport: Services['scanReport'],
  text: RawText,
  scanId: string,
  dispatch: (event: FlowEvent) => void,
  isActive: () => boolean,
): Promise<void> {
  const onProgress: ProgressCallback = (done, total) => {
    if (isActive()) dispatch({ type: 'SCAN_PROGRESS', scanId, done, total });
  };
  let event: FlowEvent;
  try {
    event = outcomeEvent(scanId, await scanReport(text, onProgress, () => !isActive()));
  } catch {
    event = failureEvent(scanId);
  }
  if (!isActive()) return;
  if (event.type === 'SCAN_FAILED') logger.warn('Scan failed', { kind: event.error.kind });
  dispatch(event);
}

/**
 * The scan side effect, derived from the state: entering an on-device `scanning` state starts
 * the scan; leaving it (done, failed, cancelled, reset) or unmounting stops it. A scan of any
 * other mode (the future consented cloud scan) is never run here, so the cloud-capable path
 * cannot reuse the on-device pipeline by accident, and the other way round.
 */
export function useOnDeviceScan(
  state: FlowState,
  dispatch: Dispatch<FlowEvent>,
  scanReport: Services['scanReport'],
): void {
  const scanning = state.status === 'scanning' && state.mode === 'onDevice' ? state : null;
  const scanId = scanning?.scanId ?? null;
  const scanText = scanning?.text ?? null;
  useEffect(() => {
    if (scanId === null || scanText === null) return;
    let active = true;
    void runScan(scanReport, scanText, scanId, dispatch, () => active);
    return () => {
      active = false;
    };
  }, [scanId, scanText, scanReport, dispatch]);
}
