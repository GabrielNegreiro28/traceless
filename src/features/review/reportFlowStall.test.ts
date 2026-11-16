import { describe, expect, it } from 'vitest';
import { scoreRisk } from '../../domain/risk/riskScorer';
import { createAppError } from '../../shared/appError';
import { FAILURE, FINDINGS, TEXT, reviewing } from './reportFlowTestKit';
import { reportFlowReducer, toError, type FlowState } from './reportFlowMachine';
import { isRecoverableStall, isStall, isTerminalStall } from './reportFlowStall';
import { composing } from './reportFlowTypes';

const stuck = (recoverable: boolean) =>
  createAppError('OnDeviceStuck', { message: 'stalled', recoverable });

const recoverable = toError(stuck(true), composing(TEXT));
const terminal = toError(stuck(false), composing(TEXT));
const RULE_FINDINGS = FINDINGS.slice(0, 1);

describe('stall states (§G.2)', () => {
  it('tells recoverable and terminal stalls apart, only over the composer', () => {
    expect([isStall(recoverable), isRecoverableStall(recoverable)]).toEqual([true, true]);
    expect([isStall(terminal), isTerminalStall(terminal)]).toEqual([true, true]);
    expect(isTerminalStall(recoverable) || isRecoverableStall(terminal)).toBe(false);
    expect(isStall(toError(FAILURE, composing(TEXT)))).toBe(false);
    expect(isStall(toError(stuck(false), reviewing))).toBe(false);
    expect(isStall(composing(TEXT))).toBe(false);
  });

  it('a terminal stall opens a basic-checks review with the kept text', () => {
    const next = reportFlowReducer(terminal, {
      type: 'BASIC_CHECKS_DONE',
      findings: RULE_FINDINGS,
    });
    expect(next).toEqual({
      status: 'reviewing',
      text: TEXT,
      checks: 'basic',
      findings: RULE_FINDINGS,
      protectedSpans: [],
      decisions: [],
      risk: scoreRisk(RULE_FINDINGS),
    });
  });

  it.each<[string, FlowState]>([
    ['a recoverable stall', recoverable],
    ['another error', toError(FAILURE, composing(TEXT))],
    ['the composer', composing(TEXT)],
    ['a review', reviewing],
  ])('ignores BASIC_CHECKS_DONE from %s', (_, state) => {
    expect(reportFlowReducer(state, { type: 'BASIC_CHECKS_DONE', findings: [] })).toBe(state);
  });

  it('BACK_TO_EDIT from a stall returns to the composer with the text', () => {
    expect(reportFlowReducer(recoverable, { type: 'BACK_TO_EDIT' })).toEqual(composing(TEXT));
    expect(reportFlowReducer(terminal, { type: 'BACK_TO_EDIT' })).toEqual(composing(TEXT));
  });

  it('a full scan reviews with checks full; basic survives the outbox and back', () => {
    const scanned = reportFlowReducer(
      { status: 'scanning', text: TEXT, mode: 'onDevice', scanId: 's', progress: null },
      { type: 'SCAN_DONE', scanId: 's', findings: FINDINGS },
    );
    expect(scanned).toMatchObject({ status: 'reviewing', checks: 'full' });

    const basic = reportFlowReducer(terminal, { type: 'BASIC_CHECKS_DONE', findings: [] });
    const ticked = reportFlowReducer(basic, { type: 'CONFIRM_SECOND_LOOK', confirmed: true });
    const outbox = reportFlowReducer(ticked, { type: 'OPEN_OUTBOX' });
    expect(outbox).toMatchObject({ status: 'outbox', checks: 'basic' });
    expect(reportFlowReducer(outbox, { type: 'BACK_TO_EDIT' })).toEqual(ticked);
  });
});
