import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../../app/services/useServices';
import type { InferenceSourceKind } from '../../application/ports/IdentityScanner';
import type { StructureOutcome } from '../../application/ports/ReportStructurer';
import type { ReportCategory, StructuredReport } from '../../domain/report/structuredReport';
import type { SanitizedText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { createAppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import type { Result } from '../../shared/result';
import type { FlowState } from '../review/reportFlowTypes';

export type StructureStatus = 'idle' | 'loading' | 'ready' | 'failed';

/** The structured card's state for the approved text currently on screen. */
export interface ReportStructureView {
  readonly status: StructureStatus;
  readonly report: StructuredReport | null;
  readonly source: InferenceSourceKind | null;
  /** The category to send: the reporter's choice, else the model's; null when none. */
  readonly category: ReportCategory | null;
  readonly setCategory: (category: ReportCategory) => void;
}

interface Settled {
  readonly text: SanitizedText;
  readonly result: Result<StructureOutcome, AppError>;
}

interface Choice {
  readonly text: SanitizedText;
  readonly category: ReportCategory;
}

const CRASHED = createAppError('Unknown', { message: 'Organizing the report threw.' });

/** The approved text on the approved/submitting screens or behind a failed send; else null. */
export function approvedTextOf(state: FlowState): SanitizedText | null {
  if (state.status === 'approved' || state.status === 'submitting') return state.report.text;
  if (state.status === 'error' && state.previous.status === 'approved') {
    return state.previous.report.text;
  }
  return null;
}

/** The view for `text` from the latest settled result and choice (stale ones are ignored). */
function viewOf(text: SanitizedText | null, settled: Settled | null, choice: Choice | null) {
  if (text === null) return { status: 'idle' as const, outcome: null, category: null };
  if (settled?.text !== text) return { status: 'loading' as const, outcome: null, category: null };
  if (!settled.result.ok) return { status: 'failed' as const, outcome: null, category: null };
  const outcome = settled.result.value;
  const chosen = choice?.text === text ? choice.category : null;
  return { status: 'ready' as const, outcome, category: chosen ?? outcome.report.category };
}

/**
 * Runs `structureReport` once per approved text (going back and approving the same text again
 * reuses the result; nothing is re-sent). Optional by design: a failure only changes the card,
 * never the send. Holds results in memory only.
 */
export function useReportStructure(state: FlowState): ReportStructureView {
  const { structureReport } = useServices();
  const text = approvedTextOf(state);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const requested = useRef<SanitizedText | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (text === null || requested.current === text) return;
    requested.current = text;
    void structureReport(text)
      .catch(() => ({ ok: false as const, error: CRASHED }))
      .then((result) => {
        if (!result.ok) logger.warn('Structuring failed', { kind: result.error.kind });
        if (mounted.current && requested.current === text) setSettled({ text, result });
      });
  }, [text, structureReport]);

  const setCategory = useCallback(
    (category: ReportCategory) => {
      if (text !== null) setChoice({ text, category });
    },
    [text],
  );

  const view = viewOf(text, settled, choice);
  return {
    status: view.status,
    report: view.outcome?.report ?? null,
    source: view.outcome?.source ?? null,
    category: view.category,
    setCategory,
  };
}
