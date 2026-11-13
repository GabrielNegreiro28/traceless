import type { ApprovedReport } from '../../application/usecases/approveReport';
import type { Finding } from '../../domain/detection/types';
import type { ReviewChoice, ReviewDecision } from '../../domain/rewrite/rewriteApplier';
import type { RiskAssessment } from '../../domain/risk/riskScorer';
import { toRawText, type RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';

/** States of the reporter's flow (PLANO §3.6). Raw text lives only in memory. */
export interface ComposingState {
  readonly status: 'composing';
  readonly text: RawText;
}

export interface ScanProgress {
  readonly done: number;
  readonly total: number;
}

export interface ScanningState {
  readonly status: 'scanning';
  readonly text: RawText;
  /** Identifies this scan; events from any other (stale) scan are ignored. */
  readonly scanId: string;
  /** Null until the scanner reports the number of chunks. */
  readonly progress: ScanProgress | null;
}

export interface ReviewingState {
  readonly status: 'reviewing';
  readonly text: RawText;
  readonly findings: readonly Finding[];
  readonly decisions: readonly ReviewDecision[];
  /** Live risk of the findings that remain after the decisions so far. */
  readonly risk: RiskAssessment;
}

/**
 * The rewritten text is previewed ("only this text will leave your device") together
 * with the acknowledgement checkbox; approveReport runs from here. Keeps the review so
 * BACK_TO_EDIT can reopen it unchanged.
 */
export interface OutboxState extends Omit<ReviewingState, 'status'> {
  readonly status: 'outbox';
  /** The decisions applied to the text; still raw until approved. */
  readonly preview: RawText;
}

/** SanitizedText exists from here on (created by approveReport in the outbox). */
export interface ApprovedState extends Omit<OutboxState, 'status'> {
  readonly status: 'approved';
  readonly report: ApprovedReport;
}

export interface SubmittingState extends Omit<ApprovedState, 'status'> {
  readonly status: 'submitting';
}

export interface SubmittedState {
  readonly status: 'submitted';
  /** True when the case key was issued (it is shown once and never stored here). */
  readonly caseKeyPresent: boolean;
}

/** On-device AI is unavailable: the reporter must choose (PLANO §3.7) before scanning. */
export interface NeedsConsentState {
  readonly status: 'needsConsent';
  readonly text: RawText;
}

/** The states an error can return to. */
export type RecoverableState = ComposingState | ReviewingState | OutboxState | ApprovedState;

export interface ErrorState {
  readonly status: 'error';
  readonly error: AppError;
  readonly previous: RecoverableState;
}

export type FlowState =
  | ComposingState
  | ScanningState
  | ReviewingState
  | OutboxState
  | ApprovedState
  | SubmittingState
  | SubmittedState
  | NeedsConsentState
  | ErrorState;

export type FlowStatus = FlowState['status'];

export type FlowEvent =
  | { readonly type: 'EDIT_TEXT'; readonly text: RawText }
  | { readonly type: 'START_SCAN'; readonly scanId: string }
  | {
      readonly type: 'SCAN_PROGRESS';
      readonly scanId: string;
      readonly done: number;
      readonly total: number;
    }
  | { readonly type: 'SCAN_DONE'; readonly scanId: string; readonly findings: readonly Finding[] }
  | { readonly type: 'SCAN_FAILED'; readonly scanId: string; readonly error: AppError }
  /** Also applied to findings with the identical quote (see propagateDecision). */
  | { readonly type: 'DECIDE'; readonly findingId: string; readonly choice: ReviewChoice }
  | { readonly type: 'UNDO_DECISION'; readonly findingId: string }
  | { readonly type: 'APPROVE_OK'; readonly report: ApprovedReport }
  | { readonly type: 'APPROVE_FAILED'; readonly error: AppError }
  | { readonly type: 'BACK_TO_EDIT' }
  | { readonly type: 'OPEN_OUTBOX' }
  | { readonly type: 'SUBMIT' }
  | { readonly type: 'SUBMIT_OK'; readonly caseKeyPresent: boolean }
  | { readonly type: 'SUBMIT_FAILED'; readonly error: AppError }
  | { readonly type: 'CONSENT_REQUIRED' }
  | { readonly type: 'RESET' };

export type FlowEventType = FlowEvent['type'];

export const INITIAL_FLOW_STATE: ComposingState = { status: 'composing', text: toRawText('') };

export function composing(text: RawText): ComposingState {
  return { status: 'composing', text };
}

export function toError(error: AppError, previous: RecoverableState): ErrorState {
  return { status: 'error', error, previous };
}
