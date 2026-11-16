import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useServices } from '../../app/services/useServices';
import type {
  DeviceAvailability,
  DeviceCapability,
} from '../../application/ports/DeviceCapability';
import type { ReviewChoice } from '../../domain/rewrite/reviewDecision';
import { toRawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import { err, type Result } from '../../shared/result';
import { useSubmission, type Submission } from '../submit/useSubmission';
import {
  INITIAL_FLOW_STATE,
  reportFlowReducer,
  type FlowEvent,
  type FlowState,
} from './reportFlowMachine';
import { useApproval } from './useApproval';
import { useCheckOptions, type CheckOptionActions } from './useCheckOptions';
import { useConsentedCloudScan } from './useConsentedCloudScan';
import { useOnDeviceScan } from './useOnDeviceScan';
import { useStallRecovery, type StallActions } from './useStallRecovery';

export interface ReportFlow extends StallActions, CheckOptionActions {
  readonly state: FlowState;
  /** True while the device is checked just after "Check my report" (before scanning). */
  readonly checking: boolean;
  readonly setText: (text: string) => void;
  readonly startScan: () => void;
  /** Starts the one-time model download. MUST be called from the click on its own button. */
  readonly prepare: () => void;
  readonly cancelScan: () => void;
  /** Review: records a choice (also applied to identical quotes) or undoes it. */
  readonly decide: (findingId: string, choice: ReviewChoice) => void;
  readonly undoDecision: (findingId: string) => void;
  /** Review: "Continue" (the outbox is where approveReport gates what is sent). */
  readonly confirmSecondLook: (confirmed: boolean) => void;
  readonly openOutbox: () => void;
  /** Outbox: approves the previewed text; `acknowledged` is the residual-risk checkbox. */
  readonly approve: (acknowledged: boolean) => void;
  /** Back to the previous editable state (dismisses an error, leaves consent or review). */
  readonly backToEdit: () => void;
  /** From an approval error: reopens the review the outbox came from. */
  readonly backToReview: () => void;
  readonly reset: () => void;
  /** Sending the approved report and the case key shown once (Fase 4). */
  readonly submission: Submission;
}

/** The port never throws; a rejection anyway reads as "unavailable" (the safe, local-only path). */
async function checkDevice(capability: DeviceCapability): Promise<DeviceAvailability> {
  try {
    return await capability.check();
  } catch {
    return 'unavailable';
  }
}

async function prepareDevice(
  capability: DeviceCapability,
  onProgress: (fraction: number) => void,
): Promise<Result<void, AppError>> {
  try {
    return await capability.prepare(onProgress);
  } catch {
    return err(createAppError('Unknown', { message: 'Preparing the on-device AI failed.' }));
  }
}

/**
 * Wraps the pure reducer for the reporter's flow. The scan side effects live in
 * useOnDeviceScan and useConsentedCloudScan (one per mode); this hook routes by device
 * availability and runs the model download. Raw text only ever lives in this state.
 */
export function useReportFlow(): ReportFlow {
  const { scanReport, scanWithCloudConsent, deviceCapability } = useServices();
  const [state, dispatch] = useReducer(reportFlowReducer, INITIAL_FLOW_STATE);
  const [checking, setChecking] = useState(false);
  const latest = useRef(state);
  const mounted = useRef(true);
  const scanCounter = useRef(0);
  const prepareToken = useRef(0);
  const preparing = useRef(false);

  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useOnDeviceScan(state, dispatch, scanReport);
  useConsentedCloudScan(state, dispatch, scanWithCloudConsent);
  const approve = useApproval(state, dispatch);
  const submission = useSubmission(state, dispatch);

  const nextScanId = useCallback((): string => {
    scanCounter.current += 1;
    return `scan-${String(scanCounter.current)}`;
  }, []);

  /** Only a ready model scans; a missing one is downloaded first, never silently skipped. */
  const route = useCallback(
    (availability: DeviceAvailability): FlowEvent => {
      if (availability === 'available') return { type: 'START_SCAN', scanId: nextScanId() };
      if (availability === 'unavailable') return { type: 'CONSENT_REQUIRED' };
      return { type: 'PREPARE_REQUIRED' };
    },
    [nextScanId],
  );

  /** Checks the device, then routes from the composer (see `route`). */
  const checkAndRoute = useCallback(() => {
    setChecking(true);
    void (async () => {
      try {
        const availability = await checkDevice(deviceCapability);
        if (mounted.current) dispatch(route(availability));
      } finally {
        if (mounted.current) setChecking(false);
      }
    })();
  }, [deviceCapability, route]);

  const startScan = useCallback(() => {
    if (checking || latest.current.status !== 'composing') return;
    checkAndRoute();
  }, [checking, checkAndRoute]);

  const stall = useStallRecovery(latest, dispatch, checkAndRoute);

  /** Invalidates a running download's callbacks (the download itself continues in Chrome). */
  const abandonPrepare = useCallback(() => {
    prepareToken.current += 1;
    preparing.current = false;
  }, []);
  const options = useCheckOptions(latest, dispatch, nextScanId, abandonPrepare);

  const prepare = useCallback(() => {
    if (preparing.current || latest.current.status !== 'needsPrepare') return;
    preparing.current = true;
    prepareToken.current += 1;
    const token = prepareToken.current;
    const isLive = (): boolean => mounted.current && prepareToken.current === token;
    dispatch({ type: 'PREPARE_PROGRESS', fraction: 0 });
    // prepareDevice calls capability.prepare synchronously, inside this click handler.
    void prepareDevice(deviceCapability, (fraction) => {
      if (isLive()) dispatch({ type: 'PREPARE_PROGRESS', fraction });
    }).then((outcome) => {
      if (!isLive()) return;
      preparing.current = false;
      if (outcome.ok) {
        dispatch({ type: 'START_SCAN', scanId: nextScanId() });
        return;
      }
      logger.warn('Prepare failed', { kind: outcome.error.kind });
      dispatch({ type: 'PREPARE_FAILED', error: outcome.error });
    });
  }, [deviceCapability, nextScanId]);

  const setText = useCallback((text: string) => {
    dispatch({ type: 'EDIT_TEXT', text: toRawText(text) });
  }, []);
  const cancelScan = useCallback(() => dispatch({ type: 'CANCEL_SCAN' }), []);
  const decide = useCallback((findingId: string, choice: ReviewChoice) => {
    dispatch({ type: 'DECIDE', findingId, choice });
  }, []);
  const undoDecision = useCallback((findingId: string) => {
    dispatch({ type: 'UNDO_DECISION', findingId });
  }, []);
  const confirmSecondLook = useCallback((confirmed: boolean) => {
    dispatch({ type: 'CONFIRM_SECOND_LOOK', confirmed });
  }, []);
  const openOutbox = useCallback(() => dispatch({ type: 'OPEN_OUTBOX' }), []);
  const backToEdit = useCallback(() => {
    abandonPrepare();
    dispatch({ type: 'BACK_TO_EDIT' });
  }, [abandonPrepare]);
  const backToReview = useCallback(() => dispatch({ type: 'BACK_TO_REVIEW' }), []);
  const reset = useCallback(() => {
    abandonPrepare();
    dispatch({ type: 'RESET' });
  }, [abandonPrepare]);

  return {
    state,
    checking,
    setText,
    startScan,
    prepare,
    cancelScan,
    decide,
    undoDecision,
    confirmSecondLook,
    openOutbox,
    approve,
    backToEdit,
    backToReview,
    reset,
    submission,
    ...stall,
    ...options,
  };
}
