import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { useServices } from '../../app/services/useServices';
import type { CaseKey } from '../../domain/case/caseKey';
import type { ReportCategory } from '../../domain/report/structuredReport';
import type { SanitizedText } from '../../domain/text/brandedText';
import { createAppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import type { ApprovedState, FlowEvent, FlowState } from '../review/reportFlowTypes';
import { useLeaveWarning } from './useLeaveWarning';

export interface Submission {
  /** Sends the approved report; also retries from a failed send. */
  readonly submit: () => void;
  /**
   * The case key of the report just sent, held only in this component's memory so the case
   * key screen can show it once. Never written to storage, the URL or the flow state.
   */
  readonly caseKey: CaseKey | null;
  /** "I saved my key": forgets the key and starts over with an empty composer. */
  readonly finish: () => void;
}

/** A throw here means the outcome is unknown: never claim the report was not sent. */
const CRASHED = createAppError('SubmitUnconfirmed', {
  message: 'Sending the report threw; the outcome is unknown.',
});

/** The key issued for one approved text, reused by every retry of that same text. */
interface PendingKey {
  readonly text: SanitizedText;
  readonly caseKey: CaseKey;
}

/** The approved report to send: the approved screen, or the one a failed send returned to. */
function approvedToSend(state: FlowState): ApprovedState | null {
  if (state.status === 'approved') return state;
  if (state.status === 'error' && state.previous.status === 'approved') return state.previous;
  return null;
}

/**
 * The approved screen's "Send to organization" (Fase 4): runs `submitReport` from the
 * services (which sign in anonymously, write to Firestore and record the privacy ledger)
 * with the approved SanitizedText, and dispatches approved → submitting → submitted.
 *
 * Retries are idempotent: the case key issued for an approved text is kept in memory and
 * reused while the text is the same, so a retry after an unconfirmed send finds the report
 * that already arrived instead of creating a second case. Closing the tab mid-send warns.
 */
export function useSubmission(
  state: FlowState,
  dispatch: Dispatch<FlowEvent>,
  /** The structured card's category, sent with the text when present (never required). */
  category: ReportCategory | null = null,
): Submission {
  const { submitReport, issueCaseKey } = useServices();
  const [caseKey, setCaseKey] = useState<CaseKey | null>(null);
  const mounted = useRef(true);
  const sending = useRef(false);
  const pending = useRef<PendingKey | null>(null);
  useLeaveWarning(state.status === 'submitting');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const keyFor = useCallback(
    (text: SanitizedText): CaseKey => {
      if (pending.current?.text !== text) pending.current = { text, caseKey: issueCaseKey() };
      return pending.current.caseKey;
    },
    [issueCaseKey],
  );

  const submit = useCallback(() => {
    const approved = approvedToSend(state);
    if (approved === null || sending.current) return;
    sending.current = true;
    const text = approved.report.text;
    if (state.status === 'error') dispatch({ type: 'BACK_TO_EDIT' });
    dispatch({ type: 'SUBMIT' });
    void submitReport(text, keyFor(text), category === null ? {} : { category })
      .catch(() => ({ ok: false as const, error: CRASHED }))
      .then((result) => {
        sending.current = false;
        if (!mounted.current) return;
        if (result.ok) {
          pending.current = null;
          setCaseKey(result.value.caseKey);
          dispatch({ type: 'SUBMIT_OK', caseKeyPresent: true });
          return;
        }
        logger.warn('Send failed', { kind: result.error.kind });
        dispatch({ type: 'SUBMIT_FAILED', error: result.error });
      });
  }, [category, dispatch, keyFor, state, submitReport]);

  const finish = useCallback(() => {
    pending.current = null;
    setCaseKey(null);
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return { submit, caseKey, finish };
}
