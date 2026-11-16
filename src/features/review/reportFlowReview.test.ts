import { describe, expect, it } from 'vitest';
import { remainingRisk } from '../../domain/review/reviewState';
import { toRawText } from '../../domain/text/brandedText';
import { reportFlowReducer, type FlowState, type ReviewingState } from './reportFlowMachine';
import {
  DOCK,
  FAILURE,
  FINDINGS,
  NAME_1,
  NAME_2,
  ROLE,
  TEXT,
  approved,
  approvedReport,
  outbox,
  reviewing,
  submitting,
} from './reportFlowTestKit';

function decide(
  state: FlowState,
  findingId: string,
  action: 'ACCEPTED' | 'KEPT_RISK' | 'NOT_ABOUT_ME',
) {
  return reportFlowReducer(state, { type: 'DECIDE', findingId, choice: { action } });
}

function asReviewing(state: FlowState): ReviewingState {
  if (state.status !== 'reviewing') throw new Error(`expected reviewing, got ${state.status}`);
  return state;
}

describe('reportFlowReducer: reviewing decisions', () => {
  it('DECIDE records the decision and lowers the live risk', () => {
    const next = asReviewing(decide(reviewing, ROLE.id, 'ACCEPTED'));
    expect(next.decisions).toEqual([{ findingId: ROLE.id, action: 'ACCEPTED' }]);
    expect(next.risk).toEqual(remainingRisk(FINDINGS, next.decisions));
    expect(next.risk.score).toBeLessThan(reviewing.risk.score);
  });

  it('DECIDE propagates to identical quotes ("not about me" on a name)', () => {
    const next = asReviewing(decide(reviewing, NAME_1.id, 'NOT_ABOUT_ME'));
    expect(next.decisions).toEqual([
      { findingId: NAME_1.id, action: 'NOT_ABOUT_ME' },
      { findingId: NAME_2.id, action: 'NOT_ABOUT_ME', propagatedFrom: NAME_1.id },
    ]);
  });

  it('DECIDE replaces an earlier decision for the same finding', () => {
    const once = decide(reviewing, DOCK.id, 'ACCEPTED');
    const twice = asReviewing(decide(once, DOCK.id, 'KEPT_RISK'));
    expect(twice.decisions).toEqual([{ findingId: DOCK.id, action: 'KEPT_RISK' }]);
  });

  it('DECIDE ignores an unknown finding or an EDITED choice without replacement', () => {
    expect(decide(reviewing, 'ghost', 'ACCEPTED')).toBe(reviewing);
    const noReplacement = reportFlowReducer(reviewing, {
      type: 'DECIDE',
      findingId: DOCK.id,
      choice: { action: 'EDITED' },
    });
    expect(noReplacement).toBe(reviewing);
  });

  it('UNDO_DECISION removes the decision and its copies, restoring the risk', () => {
    const decided = decide(reviewing, NAME_1.id, 'NOT_ABOUT_ME');
    const undone = asReviewing(
      reportFlowReducer(decided, { type: 'UNDO_DECISION', findingId: NAME_1.id }),
    );
    expect(undone.decisions).toEqual([]);
    expect(undone.risk).toEqual(reviewing.risk);
  });

  it('UNDO_DECISION on a copy keeps that finding pending despite later propagation', () => {
    const decided = decide(reviewing, NAME_1.id, 'NOT_ABOUT_ME');
    const cleared = reportFlowReducer(decided, { type: 'UNDO_DECISION', findingId: NAME_2.id });
    const again = asReviewing(decide(cleared, NAME_1.id, 'KEPT_RISK'));
    expect(again.decisions).toContainEqual({ findingId: NAME_2.id, action: 'PENDING_BY_USER' });
    expect(again.decisions).toContainEqual({ findingId: NAME_1.id, action: 'KEPT_RISK' });
  });

  it('UNDO_DECISION without a decision is a no-op', () => {
    expect(reportFlowReducer(reviewing, { type: 'UNDO_DECISION', findingId: DOCK.id })).toBe(
      reviewing,
    );
  });
});

function confirmed<T extends FlowState>(state: T): T {
  return reportFlowReducer(state, { type: 'CONFIRM_SECOND_LOOK', confirmed: true }) as T;
}

describe('reportFlowReducer: leaving review', () => {
  it('EDIT_TEXT with new text invalidates the findings (back to composing)', () => {
    const text = toRawText('A different report.');
    expect(reportFlowReducer(reviewing, { type: 'EDIT_TEXT', text })).toEqual({
      status: 'composing',
      text,
    });
  });

  it('EDIT_TEXT with the same text keeps the review', () => {
    expect(reportFlowReducer(reviewing, { type: 'EDIT_TEXT', text: TEXT })).toBe(reviewing);
  });

  it('BACK_TO_EDIT returns to the composer with the text', () => {
    expect(reportFlowReducer(reviewing, { type: 'BACK_TO_EDIT' })).toEqual({
      status: 'composing',
      text: TEXT,
    });
  });
  it('BACK_TO_EDIT then START_SCAN forces a fresh scan and drops the old decisions', () => {
    const decided = decide(reviewing, DOCK.id, 'ACCEPTED');
    const composing = reportFlowReducer(decided, { type: 'BACK_TO_EDIT' });
    const next = reportFlowReducer(composing, { type: 'START_SCAN', scanId: 'scan-2' });
    expect(next).toMatchObject({ status: 'scanning', text: TEXT, scanId: 'scan-2' });
    expect(next).not.toHaveProperty('decisions');
  });
  it('keeps the protected spans through the outbox and back', () => {
    const withSpans = { ...confirmed(reviewing), protectedSpans: [{ start: 1, end: 3 }] };
    const opened = reportFlowReducer(withSpans, { type: 'OPEN_OUTBOX' });
    expect(opened).toMatchObject({ status: 'outbox', protectedSpans: withSpans.protectedSpans });
    expect(reportFlowReducer(opened, { type: 'BACK_TO_EDIT' })).toEqual(withSpans);
  });

  it('OPEN_OUTBOX is refused until the Second look is confirmed', () => {
    expect(reportFlowReducer(reviewing, { type: 'OPEN_OUTBOX' })).toBe(reviewing);
    const unticked = reportFlowReducer(confirmed(reviewing), {
      type: 'CONFIRM_SECOND_LOOK',
      confirmed: false,
    });
    expect(reportFlowReducer(unticked, { type: 'OPEN_OUTBOX' })).toBe(unticked);
  });

  it('CONFIRM_SECOND_LOOK is kept through the outbox and back, and ignored elsewhere', () => {
    const ticked = reportFlowReducer(reviewing, { type: 'CONFIRM_SECOND_LOOK', confirmed: true });
    expect(ticked).toEqual({ ...reviewing, secondLookConfirmed: true });
    const opened = reportFlowReducer(ticked, { type: 'OPEN_OUTBOX' });
    expect(reportFlowReducer(opened, { type: 'BACK_TO_EDIT' })).toEqual(ticked);
    expect(reportFlowReducer(outbox, { type: 'CONFIRM_SECOND_LOOK', confirmed: true })).toBe(
      outbox,
    );
  });

  it('OPEN_OUTBOX previews the rewritten text, keeping the review', () => {
    const decided = confirmed(decide(reviewing, DOCK.id, 'ACCEPTED'));
    expect(reportFlowReducer(decided, { type: 'OPEN_OUTBOX' })).toEqual({
      ...decided,
      status: 'outbox',
      preview: TEXT.replace('Dock B', '[place]'),
    });
  });

  it('OPEN_OUTBOX with a stale review shows the error and returns to the review', () => {
    const stale: ReviewingState = {
      ...confirmed(reviewing),
      decisions: [{ findingId: 'ghost', action: 'ACCEPTED' }],
    };
    const next = reportFlowReducer(stale, { type: 'OPEN_OUTBOX' });
    expect(next).toMatchObject({ status: 'error', error: { kind: 'Unknown' }, previous: stale });
  });
});

describe('reportFlowReducer: outbox, approval and submission', () => {
  it('outbox: APPROVE_OK moves to approved with the report', () => {
    const report = approvedReport();
    expect(reportFlowReducer(outbox, { type: 'APPROVE_OK', report })).toEqual({
      ...outbox,
      status: 'approved',
      report,
    });
  });

  it('outbox: APPROVE_FAILED shows the error and returns to the outbox', () => {
    const next = reportFlowReducer(outbox, { type: 'APPROVE_FAILED', error: FAILURE });
    expect(next).toEqual({ status: 'error', error: FAILURE, previous: outbox });
    expect(reportFlowReducer(next, { type: 'BACK_TO_EDIT' })).toBe(outbox);
  });

  it('outbox: APPROVE_OK for a text other than the preview is an error, never approved', () => {
    const report = approvedReport(toRawText('I am somebody else entirely.'));
    const next = reportFlowReducer(outbox, { type: 'APPROVE_OK', report });
    expect(next).toMatchObject({ status: 'error', error: { kind: 'ApprovalMismatch' } });
    expect(next).toEqual({
      status: 'error',
      error: expect.anything() as unknown,
      previous: outbox,
    });
    expect(JSON.stringify(next.status === 'error' ? next.error : null)).not.toContain('somebody');
  });

  it('error from the outbox: BACK_TO_REVIEW reopens the review, BACK_TO_EDIT the outbox', () => {
    const next = reportFlowReducer(outbox, { type: 'APPROVE_FAILED', error: FAILURE });
    expect(reportFlowReducer(next, { type: 'BACK_TO_REVIEW' })).toEqual(reviewing);
    expect(reportFlowReducer(next, { type: 'BACK_TO_EDIT' })).toBe(outbox);
  });

  it('error from elsewhere ignores BACK_TO_REVIEW', () => {
    const errored = reportFlowReducer(
      { ...confirmed(reviewing), decisions: [{ findingId: 'ghost', action: 'ACCEPTED' }] },
      { type: 'OPEN_OUTBOX' },
    );
    expect(errored.status).toBe('error');
    expect(reportFlowReducer(errored, { type: 'BACK_TO_REVIEW' })).toBe(errored);
  });

  it('outbox: BACK_TO_EDIT reopens the review with its decisions', () => {
    expect(reportFlowReducer(outbox, { type: 'BACK_TO_EDIT' })).toEqual(reviewing);
  });

  it('approved: BACK_TO_EDIT returns to the outbox and drops the approval', () => {
    expect(reportFlowReducer(approved(), { type: 'BACK_TO_EDIT' })).toEqual(outbox);
  });

  it('approved: SUBMIT starts submitting', () => {
    const state = approved();
    expect(reportFlowReducer(state, { type: 'SUBMIT' })).toEqual({
      ...state,
      status: 'submitting',
    });
  });

  it.each([true, false])('submitting: SUBMIT_OK records caseKeyPresent=%s', (caseKeyPresent) => {
    expect(reportFlowReducer(submitting(), { type: 'SUBMIT_OK', caseKeyPresent })).toEqual({
      status: 'submitted',
      caseKeyPresent,
    });
  });

  it('submitting: SUBMIT_FAILED shows the error and returns to approved to retry', () => {
    const next = reportFlowReducer(submitting(), { type: 'SUBMIT_FAILED', error: FAILURE });
    expect(next).toEqual({ status: 'error', error: FAILURE, previous: approved() });
    expect(reportFlowReducer(next, { type: 'BACK_TO_EDIT' })).toEqual(approved());
  });

  it('a failed send retries through approved: error → approved → submitting → submitted', () => {
    const failed = reportFlowReducer(submitting(), { type: 'SUBMIT_FAILED', error: FAILURE });
    expect(reportFlowReducer(failed, { type: 'SUBMIT' })).toBe(failed);
    const retried = [{ type: 'BACK_TO_EDIT' }, { type: 'SUBMIT' }] as const;
    const sending = retried.reduce<FlowState>(reportFlowReducer, failed);
    expect(sending.status).toBe('submitting');
    const sent = reportFlowReducer(sending, { type: 'SUBMIT_OK', caseKeyPresent: true });
    expect(sent).toEqual({ status: 'submitted', caseKeyPresent: true });
  });

  it('submitted keeps no report text and no case key', () => {
    const sent = reportFlowReducer(submitting(), { type: 'SUBMIT_OK', caseKeyPresent: true });
    expect(JSON.stringify(sent)).not.toContain(TEXT);
    expect(Object.keys(sent).sort()).toEqual(['caseKeyPresent', 'status']);
    expect(reportFlowReducer(sent, { type: 'SUBMIT' })).toBe(sent);
  });
});
