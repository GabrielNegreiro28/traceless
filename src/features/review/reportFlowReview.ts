import type { ApprovedReport } from '../../application/usecases/approveReport';
import { propagateDecision, undoDecision } from '../../domain/review/decisionPropagation';
import { isDecisionValid, remainingRisk } from '../../domain/review/reviewState';
import {
  applyDecisions,
  type ReviewChoice,
  type ReviewDecision,
} from '../../domain/rewrite/rewriteApplier';
import { createAppError } from '../../shared/appError';
import type {
  ApprovedState,
  FlowEvent,
  FlowState,
  OutboxState,
  ReviewingState,
  SubmittingState,
} from './reportFlowTypes';
import { composing, toError } from './reportFlowTypes';

/** Transitions from review to submission (pure). */

function withDecisions(
  state: ReviewingState,
  decisions: readonly ReviewDecision[],
): ReviewingState {
  return { ...state, decisions, risk: remainingRisk(state.findings, decisions) };
}

function decide(state: ReviewingState, findingId: string, choice: ReviewChoice): ReviewingState {
  if (!isDecisionValid(state.findings, findingId, choice)) return state;
  return withDecisions(
    state,
    propagateDecision(state.findings, state.decisions, findingId, choice),
  );
}

function undo(state: ReviewingState, findingId: string): ReviewingState {
  if (!state.decisions.some((d) => d.findingId === findingId)) return state;
  return withDecisions(state, undoDecision(state.decisions, findingId));
}

export function toReviewing(state: OutboxState): ReviewingState {
  const { text, checks, findings, protectedSpans, decisions, risk, secondLookConfirmed } = state;
  return {
    status: 'reviewing',
    text,
    checks,
    findings,
    protectedSpans,
    decisions,
    risk,
    ...(secondLookConfirmed === true && { secondLookConfirmed }),
  };
}

function toOutbox(state: ApprovedState | SubmittingState): OutboxState {
  const { text, checks, findings, protectedSpans, decisions, risk, preview } = state;
  return { status: 'outbox', text, checks, findings, protectedSpans, decisions, risk, preview };
}

/** Previews the decisions applied to the text; a failed rewrite stays on the review. */
function openOutbox(state: ReviewingState): FlowState {
  if (state.secondLookConfirmed !== true) return state;
  const preview = applyDecisions(state.text, state.findings, state.decisions);
  if (!preview.ok) return toError(preview.error, state);
  return { ...state, status: 'outbox', preview: preview.value };
}

/** Editing the text invalidates every finding, so it returns to composing. */
export function onReviewing(state: ReviewingState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'EDIT_TEXT':
      return event.text === state.text ? state : composing(event.text);
    case 'DECIDE':
      return decide(state, event.findingId, event.choice);
    case 'UNDO_DECISION':
      return undo(state, event.findingId);
    case 'CONFIRM_SECOND_LOOK':
      return { ...state, secondLookConfirmed: event.confirmed };
    case 'OPEN_OUTBOX':
      return openOutbox(state);
    case 'BACK_TO_EDIT':
      return composing(state.text);
    default:
      return state;
  }
}

/** Fixed message: never includes report text. */
const MISMATCH = createAppError('ApprovalMismatch', {
  message: 'The approved text differs from the previewed text; the approval was discarded.',
});

/** Compares as plain strings: the two texts carry different privacy brands. */
function isSameText(approved: string, previewed: string): boolean {
  return approved === previewed;
}

/** Only the exact text the reporter saw may become the approved report. */
function approve(state: OutboxState, report: ApprovedReport): FlowState {
  if (!isSameText(report.text, state.preview)) return toError(MISMATCH, state);
  return { ...state, status: 'approved', report };
}

/** The reporter sees exactly what will leave the device and approves it here. */
export function onOutbox(state: OutboxState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'APPROVE_OK':
      return approve(state, event.report);
    case 'APPROVE_FAILED':
      return toError(event.error, state);
    case 'BACK_TO_EDIT':
      return toReviewing(state);
    default:
      return state;
  }
}

/** BACK_TO_EDIT returns to the outbox and discards the approval. */
export function onApproved(state: ApprovedState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'SUBMIT':
      return { ...state, status: 'submitting' };
    case 'BACK_TO_EDIT':
      return toOutbox(state);
    default:
      return state;
  }
}

/** A failed submission returns (through the error) to the approved report, ready to retry. */
export function onSubmitting(state: SubmittingState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'SUBMIT_OK':
      return { status: 'submitted', caseKeyPresent: event.caseKeyPresent };
    case 'SUBMIT_FAILED':
      return toError(event.error, { ...state, status: 'approved' });
    default:
      return state;
  }
}
