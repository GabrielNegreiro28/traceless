import { describe, expect, it } from 'vitest';
import { CASE_STATUSES, caseStatusRank, isCaseStatus } from './caseStatus';
import { buildCaseTimeline, DAY_MS, DEFAULT_DEADLINES } from './caseTimeline';

const CREATED = Date.UTC(2026, 10, 16, 12);

describe('buildCaseTimeline', () => {
  it('puts the deadlines 7 and 90 days after the report', () => {
    const steps = buildCaseTimeline(CREATED, 'received', DEFAULT_DEADLINES, CREATED);
    expect(steps.map((s) => s.id)).toEqual(['received', 'acknowledged', 'feedbackGiven']);
    expect(steps[0]).toEqual({
      id: 'received',
      done: true,
      at: CREATED,
      dueAt: null,
      overdue: false,
    });
    expect(steps[1]?.dueAt).toBe(CREATED + 7 * DAY_MS);
    expect(steps[2]?.dueAt).toBe(CREATED + 90 * DAY_MS);
  });

  it('uses the configured deadlines', () => {
    const steps = buildCaseTimeline(CREATED, 'received', { ackDays: 3, feedbackDays: 30 }, 0);
    expect(steps[1]?.dueAt).toBe(CREATED + 3 * DAY_MS);
    expect(steps[2]?.dueAt).toBe(CREATED + 30 * DAY_MS);
  });

  it('marks a pending step overdue only after its deadline', () => {
    const before = buildCaseTimeline(CREATED, 'received', DEFAULT_DEADLINES, CREATED + 7 * DAY_MS);
    const after = buildCaseTimeline(CREATED, 'received', DEFAULT_DEADLINES, CREATED + 8 * DAY_MS);
    expect(before[1]?.overdue).toBe(false);
    expect(after[1]?.overdue).toBe(true);
    expect(after[2]?.overdue).toBe(false);
  });

  it.each([
    ['received', [true, false, false]],
    ['acknowledged', [true, true, false]],
    ['feedbackGiven', [true, true, true]],
    ['closed', [true, true, true]],
  ] as const)('status %s marks the steps done as %j', (status, done) => {
    const late = CREATED + 365 * DAY_MS;
    const steps = buildCaseTimeline(CREATED, status, DEFAULT_DEADLINES, late);
    expect(steps.map((s) => s.done)).toEqual(done);
    expect(steps.filter((s) => s.done).every((s) => !s.overdue)).toBe(true);
  });
});

describe('caseStatus', () => {
  it('ranks statuses in order of progress', () => {
    expect(CASE_STATUSES.map(caseStatusRank)).toEqual([0, 1, 2, 3]);
  });

  it('recognizes only known statuses', () => {
    expect(isCaseStatus('received')).toBe(true);
    expect(isCaseStatus('deleted')).toBe(false);
    expect(isCaseStatus(1)).toBe(false);
  });
});
