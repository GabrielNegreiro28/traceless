import { useEffect, type Dispatch } from 'react';
import type { Services } from '../../app/compositionRoot';
import type { FlowEvent, FlowState } from './reportFlowMachine';
import { runScan } from './scanRunner';

/**
 * The consented cloud scan side effect: entering a `consentedCloud` scanning state that
 * carries the reporter's consent starts `scanWithCloudConsent` for exactly that text and
 * consent; leaving it or unmounting stops it before its next chunk. A cloud state without a
 * consent never scans (the use case would refuse it too), and an on-device state never
 * reaches this effect.
 */
export function useConsentedCloudScan(
  state: FlowState,
  dispatch: Dispatch<FlowEvent>,
  scanWithCloudConsent: Services['scanWithCloudConsent'],
): void {
  const scanning = state.status === 'scanning' && state.mode === 'consentedCloud' ? state : null;
  const scanId = scanning?.scanId ?? null;
  const scanText = scanning?.text ?? null;
  const consent = scanning?.consent ?? null;
  useEffect(() => {
    if (scanId === null || scanText === null || consent === null) return;
    let active = true;
    void runScan(
      (onProgress, isCancelled) => scanWithCloudConsent(scanText, consent, onProgress, isCancelled),
      scanId,
      dispatch,
      () => active,
    );
    return () => {
      active = false;
    };
  }, [scanId, scanText, consent, scanWithCloudConsent, dispatch]);
}
