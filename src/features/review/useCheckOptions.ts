import { useCallback, type Dispatch, type RefObject } from 'react';
import { useServices } from '../../app/services/useServices';
import type { CloudScanConsent } from '../../application/usecases/consentToCloudScan';
import type { FlowEvent, FlowState } from './reportFlowMachine';

/** The reporter's ways forward when on-device AI is unavailable (design plan §2). */
export interface CheckOptionActions {
  /** Options screen: scans this text in the cloud with the consent just given (per scan). */
  readonly startCloudScan: (consent: CloudScanConsent) => void;
  /** Options screen: the basic private check (pattern rules only, no AI, on this device). */
  readonly runBasicCheck: () => void;
  /** Prepare screen: leaves the download for the other ways to check. */
  readonly showOptions: () => void;
}

/**
 * `latest` is the current flow state; `nextScanId` names a new scan; `abandonPrepare` drops a
 * running download's callbacks. Every action is the reporter's own click; nothing here runs
 * on its own, and the consent is never kept beyond the scan it starts.
 */
export function useCheckOptions(
  latest: RefObject<FlowState>,
  dispatch: Dispatch<FlowEvent>,
  nextScanId: () => string,
  abandonPrepare: () => void,
): CheckOptionActions {
  const { scanRulesOnly } = useServices();

  const startCloudScan = useCallback(
    (consent: CloudScanConsent) => {
      if (latest.current.status !== 'needsConsent') return;
      dispatch({ type: 'START_CLOUD_SCAN', scanId: nextScanId(), consent });
    },
    [latest, dispatch, nextScanId],
  );

  const runBasicCheck = useCallback(() => {
    const state = latest.current;
    if (state.status !== 'needsConsent') return;
    const { findings } = scanRulesOnly(state.text);
    dispatch({ type: 'BASIC_CHECKS_DONE', findings });
  }, [latest, dispatch, scanRulesOnly]);

  const showOptions = useCallback(() => {
    if (latest.current.status !== 'needsPrepare') return;
    abandonPrepare();
    dispatch({ type: 'SHOW_OPTIONS' });
  }, [latest, dispatch, abandonPrepare]);

  return { startCloudScan, runBasicCheck, showOptions };
}
