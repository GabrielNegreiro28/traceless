import { caseStatusRank, type CaseStatus } from './caseStatus';

/**
 * The follow-up timeline (EU Directive 2019/1937): the organization acknowledges receipt
 * within `ackDays` (7) and gives feedback within `feedbackDays` (90, "three months").
 * Pure: `now` is passed in.
 */
export interface DeadlineSettings {
  readonly ackDays: number;
  readonly feedbackDays: number;
}

export const DEFAULT_DEADLINES: DeadlineSettings = { ackDays: 7, feedbackDays: 90 };

export type TimelineStepId = 'received' | 'acknowledged' | 'feedbackGiven';

export interface TimelineStep {
  readonly id: TimelineStepId;
  readonly done: boolean;
  /** When it happened: only known for `received` (the server time of the report). */
  readonly at: number | null;
  /** The legal deadline for this step; null for `received`. */
  readonly dueAt: number | null;
  /** Not done and past its deadline. */
  readonly overdue: boolean;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

function deadlineStep(
  id: TimelineStepId,
  dueAt: number,
  status: CaseStatus,
  now: number,
): TimelineStep {
  const done = caseStatusRank(status) >= caseStatusRank(id);
  return { id, done, at: null, dueAt, overdue: !done && now > dueAt };
}

/** Received → acknowledgement due → feedback due, with done/overdue derived from the status. */
export function buildCaseTimeline(
  createdAt: number,
  status: CaseStatus,
  deadlines: DeadlineSettings,
  now: number,
): readonly TimelineStep[] {
  return [
    { id: 'received', done: true, at: createdAt, dueAt: null, overdue: false },
    deadlineStep('acknowledged', createdAt + deadlines.ackDays * DAY_MS, status, now),
    deadlineStep('feedbackGiven', createdAt + deadlines.feedbackDays * DAY_MS, status, now),
  ];
}
