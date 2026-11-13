import { approveReport, type ApprovedReport } from '../../application/usecases/approveReport';
import { findingOf } from '../../domain/rewrite/rewriteTestKit';
import { scoreRisk } from '../../domain/risk/riskScorer';
import { toRawText } from '../../domain/text/brandedText';
import { createAppError } from '../../shared/appError';
import type {
  ApprovedState,
  OutboxState,
  ReviewingState,
  ScanningState,
  SubmittingState,
} from './reportFlowTypes';

/** Test fixtures for the report flow reducer (no infrastructure, no React). */
export const TEXT = toRawText('I am the night lead at Dock B. Mr. Alvarez saw Mr. Alvarez sign.');
export const ROLE = findingOf(TEXT, 'the night lead', { category: 'ROLE_UNIQUE' });
export const DOCK = findingOf(TEXT, 'Dock B', { category: 'LOCATION' });
export const NAME_1 = findingOf(TEXT, 'Mr. Alvarez', { category: 'PERSONAL_TRAIT' });
export const NAME_2 = findingOf(TEXT, 'Mr. Alvarez', { category: 'PERSONAL_TRAIT' }, 1);
export const FINDINGS = [ROLE, DOCK, NAME_1, NAME_2];
export const FAILURE = createAppError('Offline', { message: 'offline' });

export function approvedReport(): ApprovedReport {
  const result = approveReport(
    { text: TEXT, findings: [], decisions: [], acknowledgedRemainingRisk: false },
    { clock: { now: () => 42 } },
  );
  if (!result.ok) throw new Error('fixture approval failed');
  return result.value;
}

export const SCAN_ID = 'scan-1';

export const scanning: ScanningState = {
  status: 'scanning',
  text: TEXT,
  mode: 'onDevice',
  scanId: SCAN_ID,
  progress: null,
};

export const reviewing: ReviewingState = {
  status: 'reviewing',
  text: TEXT,
  findings: FINDINGS,
  decisions: [],
  risk: scoreRisk(FINDINGS),
};

/** With no decisions the preview is the original text. */
export const outbox: OutboxState = { ...reviewing, status: 'outbox', preview: TEXT };

export function approved(): ApprovedState {
  return { ...outbox, status: 'approved', report: approvedReport() };
}

export function submitting(): SubmittingState {
  return { ...approved(), status: 'submitting' };
}
