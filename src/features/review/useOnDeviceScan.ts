import { useEffect, type Dispatch } from 'react';
import type { Services } from '../../app/compositionRoot';
import type { FlowEvent, FlowState } from './reportFlowMachine';
import { runScan } from './scanRunner';

/**
 * The scan side effect, derived from the state: entering an on-device `scanning` state starts
 * the scan; leaving it (done, failed, cancelled, reset) or unmounting stops it. A scan of any
 * other mode (the consented cloud scan, useConsentedCloudScan) is never run here, so the
 * cloud-capable path cannot reuse the on-device pipeline by accident, and the other way round.
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
    void runScan(
      (onProgress, isCancelled) => scanReport(scanText, onProgress, isCancelled),
      scanId,
      dispatch,
      () => active,
    );
    return () => {
      active = false;
    };
  }, [scanId, scanText, scanReport, dispatch]);
}
