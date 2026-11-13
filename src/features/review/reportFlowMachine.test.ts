import { describe, expect, it } from 'vitest';
import { scoreRisk } from '../../domain/risk/riskScorer';
import { toRawText } from '../../domain/text/brandedText';
import {
  INITIAL_FLOW_STATE,
  reportFlowReducer,
  type FlowEvent,
  type FlowState,
} from './reportFlowMachine';
import {
  FAILURE,
  FINDINGS,
  SCAN_ID,
  TEXT,
  approved,
  approvedReport,
  outbox,
  reviewing,
  scanning,
  submitting,
} from './reportFlowTestKit';

const composingText: FlowState = { status: 'composing', text: TEXT };
const needsConsent: FlowState = { status: 'needsConsent', text: TEXT };
const needsPrepare: FlowState = { status: 'needsPrepare', text: TEXT, progress: null };
const submitted: FlowState = { status: 'submitted', caseKeyPresent: true };
const errored: FlowState = { status: 'error', error: FAILURE, previous: composingText };
const scanId = SCAN_ID;

const ALL_EVENTS: readonly FlowEvent[] = [
  { type: 'EDIT_TEXT', text: toRawText('other text') },
  { type: 'START_SCAN', scanId },
  { type: 'SCAN_PROGRESS', scanId, done: 1, total: 2 },
  { type: 'SCAN_DONE', scanId, findings: FINDINGS },
  { type: 'SCAN_FAILED', scanId, error: FAILURE },
  { type: 'DECIDE', findingId: FINDINGS[0]!.id, choice: { action: 'KEPT_RISK' } },
  { type: 'UNDO_DECISION', findingId: FINDINGS[0]!.id },
  { type: 'APPROVE_OK', report: approvedReport() },
  { type: 'APPROVE_FAILED', error: FAILURE },
  { type: 'BACK_TO_EDIT' },
  { type: 'BACK_TO_REVIEW' },
  { type: 'OPEN_OUTBOX' },
  { type: 'SUBMIT' },
  { type: 'SUBMIT_OK', caseKeyPresent: true },
  { type: 'SUBMIT_FAILED', error: FAILURE },
  { type: 'CONSENT_REQUIRED' },
  { type: 'CANCEL_SCAN' },
  { type: 'PREPARE_REQUIRED' },
  { type: 'PREPARE_PROGRESS', fraction: 0.5 },
  { type: 'PREPARE_FAILED', error: FAILURE },
];

/** Events each state accepts; every other event must return the very same state. */
const ACCEPTED: ReadonlyArray<readonly [FlowState, readonly FlowEvent['type'][]]> = [
  [composingText, ['EDIT_TEXT', 'START_SCAN', 'CONSENT_REQUIRED', 'PREPARE_REQUIRED']],
  [scanning, ['SCAN_PROGRESS', 'SCAN_DONE', 'SCAN_FAILED', 'CANCEL_SCAN']],
  [needsConsent, ['START_SCAN', 'BACK_TO_EDIT']],
  [needsPrepare, ['PREPARE_PROGRESS', 'PREPARE_FAILED', 'START_SCAN', 'BACK_TO_EDIT']],
  [reviewing, ['EDIT_TEXT', 'DECIDE', 'UNDO_DECISION', 'OPEN_OUTBOX', 'BACK_TO_EDIT']],
  [outbox, ['APPROVE_OK', 'APPROVE_FAILED', 'BACK_TO_EDIT']],
  [approved(), ['SUBMIT', 'BACK_TO_EDIT']],
  [submitting(), ['SUBMIT_OK', 'SUBMIT_FAILED']],
  [submitted, []],
  [errored, ['BACK_TO_EDIT']],
];

describe('reportFlowReducer: invalid transitions are no-ops', () => {
  for (const [state, accepted] of ACCEPTED) {
    const rejected = ALL_EVENTS.filter((e) => !accepted.includes(e.type));
    it.each(rejected.map((e) => [e.type, e] as const))(`${state.status} ignores %s`, (_t, e) => {
      expect(reportFlowReducer(state, e)).toBe(state);
    });
  }
});

describe('reportFlowReducer: RESET', () => {
  it.each(ACCEPTED.map(([state]) => [state.status, state] as const))(
    'returns to an empty composer from %s',
    (_status, state) => {
      expect(reportFlowReducer(state, { type: 'RESET' })).toBe(INITIAL_FLOW_STATE);
    },
  );
});

describe('reportFlowReducer: composing', () => {
  it('starts empty', () => {
    expect(INITIAL_FLOW_STATE).toEqual({ status: 'composing', text: '' });
  });

  it('EDIT_TEXT updates the text; the same text keeps the state', () => {
    const next = reportFlowReducer(INITIAL_FLOW_STATE, { type: 'EDIT_TEXT', text: TEXT });
    expect(next).toEqual(composingText);
    expect(reportFlowReducer(next, { type: 'EDIT_TEXT', text: TEXT })).toBe(next);
  });

  it('START_SCAN begins scanning with its id and unknown progress', () => {
    expect(reportFlowReducer(composingText, { type: 'START_SCAN', scanId })).toEqual(scanning);
  });

  it('START_SCAN is ignored for a blank report', () => {
    const blank: FlowState = { status: 'composing', text: toRawText('  \n ') };
    expect(reportFlowReducer(blank, { type: 'START_SCAN', scanId })).toBe(blank);
  });

  it('CONSENT_REQUIRED asks for consent, keeping the text', () => {
    expect(reportFlowReducer(composingText, { type: 'CONSENT_REQUIRED' })).toEqual(needsConsent);
  });
});

describe('reportFlowReducer: scanning', () => {
  it('SCAN_PROGRESS records progress', () => {
    const next = reportFlowReducer(scanning, { type: 'SCAN_PROGRESS', scanId, done: 1, total: 3 });
    expect(next).toEqual({ ...scanning, progress: { done: 1, total: 3 } });
  });

  it.each([
    [4, 3],
    [-1, 3],
    [0, 0],
    [0.5, 2],
  ])('SCAN_PROGRESS ignores invalid progress %d/%d', (done, total) => {
    const event: FlowEvent = { type: 'SCAN_PROGRESS', scanId, done, total };
    expect(reportFlowReducer(scanning, event)).toBe(scanning);
  });

  it('SCAN_DONE opens the review with no decisions and the full risk', () => {
    const next = reportFlowReducer(scanning, { type: 'SCAN_DONE', scanId, findings: FINDINGS });
    expect(next).toEqual({ ...reviewing, risk: scoreRisk(FINDINGS) });
  });
  it('SCAN_DONE carries the protected spans into the review (default: none)', () => {
    const protectedSpans = [{ start: 31, end: 42 }];
    const next = reportFlowReducer(scanning, {
      type: 'SCAN_DONE',
      scanId,
      findings: FINDINGS,
      protectedSpans,
    });
    expect(next).toMatchObject({ status: 'reviewing', protectedSpans });
    expect(reviewing.protectedSpans).toEqual([]);
  });

  it('SCAN_FAILED shows the error and can return to the composer', () => {
    const next = reportFlowReducer(scanning, { type: 'SCAN_FAILED', scanId, error: FAILURE });
    expect(next).toEqual({ status: 'error', error: FAILURE, previous: composingText });
    expect(reportFlowReducer(next, { type: 'BACK_TO_EDIT' })).toEqual(composingText);
  });

  it('CANCEL_SCAN returns to composing with the text intact', () => {
    expect(reportFlowReducer(scanning, { type: 'CANCEL_SCAN' })).toEqual(composingText);
  });

  it('a late SCAN_DONE after CANCEL_SCAN is ignored', () => {
    const cancelled = reportFlowReducer(scanning, { type: 'CANCEL_SCAN' });
    const late: FlowEvent = { type: 'SCAN_DONE', scanId, findings: FINDINGS };
    expect(reportFlowReducer(cancelled, late)).toBe(cancelled);
  });

  it.each(['', undefined, null])('treats a missing or empty scanId (%s) as stale', (bad) => {
    const badId = bad as unknown as string;
    const events: FlowEvent[] = [
      { type: 'SCAN_PROGRESS', scanId: badId, done: 1, total: 2 },
      { type: 'SCAN_DONE', scanId: badId, findings: FINDINGS },
      { type: 'SCAN_FAILED', scanId: badId, error: FAILURE },
    ];
    for (const event of events) expect(reportFlowReducer(scanning, event)).toBe(scanning);
  });

  it.each(['', undefined])('START_SCAN with a missing or empty id (%s) is ignored', (bad) => {
    const event: FlowEvent = { type: 'START_SCAN', scanId: bad as unknown as string };
    expect(reportFlowReducer(composingText, event)).toBe(composingText);
    expect(reportFlowReducer(needsConsent, event)).toBe(needsConsent);
  });

  it.each<FlowEvent>([
    { type: 'SCAN_PROGRESS', scanId: 'old', done: 1, total: 2 },
    { type: 'SCAN_DONE', scanId: 'old', findings: FINDINGS },
    { type: 'SCAN_FAILED', scanId: 'old', error: FAILURE },
  ])('ignores $type from another scan', (event) => {
    expect(reportFlowReducer(scanning, event)).toBe(scanning);
  });

  it('a late SCAN_DONE from a scan abandoned by RESET is ignored', () => {
    const steps: FlowEvent[] = [
      { type: 'START_SCAN', scanId: 'T1' },
      { type: 'RESET' },
      { type: 'EDIT_TEXT', text: toRawText('A new report.') },
      { type: 'START_SCAN', scanId: 'T2' },
      { type: 'SCAN_DONE', scanId: 'T1', findings: FINDINGS },
    ];
    const final = steps.reduce(reportFlowReducer, composingText);
    expect(final).toEqual({
      status: 'scanning',
      text: 'A new report.',
      mode: 'onDevice',
      scanId: 'T2',
      progress: null,
    });
  });
});

describe('reportFlowReducer: needsPrepare', () => {
  it('PREPARE_REQUIRED from composing keeps the text and has no progress yet', () => {
    expect(reportFlowReducer(composingText, { type: 'PREPARE_REQUIRED' })).toEqual(needsPrepare);
  });

  it('PREPARE_PROGRESS records the fraction', () => {
    const next = reportFlowReducer(needsPrepare, { type: 'PREPARE_PROGRESS', fraction: 0.4 });
    expect(next).toEqual({ ...needsPrepare, progress: 0.4 });
  });

  it.each([-0.1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'PREPARE_PROGRESS ignores the invalid fraction %d',
    (fraction) => {
      const event: FlowEvent = { type: 'PREPARE_PROGRESS', fraction };
      expect(reportFlowReducer(needsPrepare, event)).toBe(needsPrepare);
    },
  );

  it('PREPARE_FAILED shows the error and Try again returns to the prepare step', () => {
    const preparing = reportFlowReducer(needsPrepare, { type: 'PREPARE_PROGRESS', fraction: 0.4 });
    const next = reportFlowReducer(preparing, { type: 'PREPARE_FAILED', error: FAILURE });
    expect(next).toEqual({ status: 'error', error: FAILURE, previous: needsPrepare });
    expect(reportFlowReducer(next, { type: 'BACK_TO_EDIT' })).toEqual(needsPrepare);
  });

  it('START_SCAN scans on-device once the model is ready', () => {
    expect(reportFlowReducer(needsPrepare, { type: 'START_SCAN', scanId })).toEqual(scanning);
  });

  it('START_SCAN with an empty id is ignored', () => {
    const event: FlowEvent = { type: 'START_SCAN', scanId: '' };
    expect(reportFlowReducer(needsPrepare, event)).toBe(needsPrepare);
  });

  it('BACK_TO_EDIT returns to the composer with the text', () => {
    expect(reportFlowReducer(needsPrepare, { type: 'BACK_TO_EDIT' })).toEqual(composingText);
  });
});

describe('reportFlowReducer: needsConsent', () => {
  it('START_SCAN scans after the reporter chose a path', () => {
    expect(reportFlowReducer(needsConsent, { type: 'START_SCAN', scanId })).toEqual(scanning);
  });

  it('BACK_TO_EDIT returns to the composer', () => {
    expect(reportFlowReducer(needsConsent, { type: 'BACK_TO_EDIT' })).toEqual(composingText);
  });
});
