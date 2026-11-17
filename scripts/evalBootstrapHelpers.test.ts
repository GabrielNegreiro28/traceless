import { describe, expect, it } from 'vitest';
import {
  bootstrapIntervals,
  mulberry32,
  tallyByReport,
  type StoredResult,
} from './evalBootstrapHelpers.ts';

const counts = (strictHit: number, goldAll: number, flagged: number, total: number) => ({
  strictHit,
  goldAll,
  mustNot: { ACCUSED: { flagged, total } },
});

const RESULT: StoredResult = {
  runs: [
    {
      reports: [
        { reportId: 'a', counts: counts(2, 4, 1, 2) },
        { reportId: 'b', counts: counts(0, 0, 0, 0) },
        { reportId: 'c', counts: counts(3, 3, 0, 2) },
      ],
    },
    {
      reports: [
        { reportId: 'a', counts: counts(1, 4, 0, 2) },
        { reportId: 'b', counts: counts(0, 0, 0, 0) },
        { reportId: 'c', counts: counts(3, 3, 0, 2) },
      ],
    },
  ],
};

describe('tallyByReport', () => {
  it('sums each report over runs', () => {
    const tallies = tallyByReport(RESULT);
    expect(tallies).toHaveLength(3);
    expect(tallies[0]).toEqual({ strictHit: 3, goldAll: 8, accusedFlagged: 1, accusedTotal: 4 });
  });
});

describe('bootstrapIntervals', () => {
  it('reports the pooled ratio of sums as the point estimate', () => {
    const { strictRecall, accusedViolation } = bootstrapIntervals(tallyByReport(RESULT), 200, 1);
    expect(strictRecall.point).toBeCloseTo(9 / 14);
    expect(accusedViolation.point).toBeCloseTo(1 / 8);
  });

  it('is deterministic for a fixed seed', () => {
    const tallies = tallyByReport(RESULT);
    const first = bootstrapIntervals(tallies, 500, 7);
    expect(bootstrapIntervals(tallies, 500, 7)).toEqual(first);
    expect(first.strictRecall.low as number).toBeLessThanOrEqual(first.strictRecall.high as number);
  });

  it('gives a degenerate interval when every report is identical', () => {
    const same = { strictHit: 1, goldAll: 2, accusedFlagged: 0, accusedTotal: 1 };
    const { strictRecall } = bootstrapIntervals([same, same, same], 100, 3);
    expect(strictRecall).toEqual({ point: 0.5, low: 0.5, high: 0.5 });
  });

  it('returns nulls when there is no gold', () => {
    const empty = { strictHit: 0, goldAll: 0, accusedFlagged: 0, accusedTotal: 0 };
    expect(bootstrapIntervals([empty], 10, 1).strictRecall).toEqual({
      point: null,
      low: null,
      high: null,
    });
  });
});

describe('mulberry32', () => {
  it('is reproducible and within [0, 1)', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    const x = a();
    expect(x).toBe(b());
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });
});
