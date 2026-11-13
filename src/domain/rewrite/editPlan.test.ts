import { describe, expect, it } from 'vitest';
import { clusterEdits, planEdits, type PlannedEdit } from './editPlan';
import { accept, edit, findingOf, keep, notAboutMe } from './rewriteTestKit';

const e = (findingId: string, start: number, end: number, typed = false): PlannedEdit => ({
  findingId,
  span: { start, end },
  replacement: findingId,
  typed,
});

describe('planEdits', () => {
  const text = 'Dock B at 6am.';
  const dock = findingOf(text, 'Dock B', { suggestion: null });
  const time = findingOf(text, '6am', { suggestion: 'early' });

  it('turns ACCEPTED/EDITED into edits and skips keep decisions', () => {
    const plan = planEdits(text, [dock, time], [accept(dock), edit(time, 'dawn')]);
    expect(plan).toEqual({
      ok: true,
      value: [
        { findingId: dock.id, span: dock.span, replacement: '', typed: false },
        { findingId: time.id, span: time.span, replacement: 'dawn', typed: true },
      ],
    });
    expect(planEdits(text, [dock, time], [keep(dock), notAboutMe(time)])).toEqual({
      ok: true,
      value: [],
    });
  });

  it('rejects an out-of-range span as stale', () => {
    const broken = { ...dock, span: { start: 40, end: 46 } };
    expect(planEdits(text, [broken], [accept(broken)]).ok).toBe(false);
  });

  it.each([
    ['KEPT_RISK', keep],
    ['NOT_ABOUT_ME', notAboutMe],
  ])('rejects a stale finding even when it is %s', (_name, decide) => {
    const stale = { ...dock, quote: 'other' };
    expect(planEdits(text, [stale], [decide(stale)])).toMatchObject({
      ok: false,
      error: { kind: 'Unknown', message: expect.stringMatching(/no longer matches/) as unknown },
    });
  });

  it('does not check findings without a decision', () => {
    const stale = { ...dock, quote: 'other' };
    expect(planEdits(text, [stale, time], [accept(time)]).ok).toBe(true);
  });
});

describe('clusterEdits', () => {
  it('returns no clusters for no edits', () => {
    expect(clusterEdits([])).toEqual([]);
  });

  it('keeps disjoint and adjacent edits separate, sorted by start', () => {
    const clusters = clusterEdits([e('b', 5, 8), e('a', 0, 5)]);
    expect(clusters.map((c) => [c.span.start, c.span.end, c.primaryId])).toEqual([
      [0, 5, 'a'],
      [5, 8, 'b'],
    ]);
  });

  it('merges a chain of overlaps into one union cluster led by the earliest edit', () => {
    const clusters = clusterEdits([e('c', 8, 12), e('b', 4, 9), e('a', 0, 5)]);
    expect(clusters).toEqual([{ span: { start: 0, end: 12 }, replacement: 'a', primaryId: 'a' }]);
  });

  it('prefers a typed (EDITED) replacement over the earliest ACCEPTED one', () => {
    const clusters = clusterEdits([e('early', 0, 6), e('typed', 3, 9, true)]);
    expect(clusters).toEqual([
      { span: { start: 0, end: 9 }, replacement: 'typed', primaryId: 'typed' },
    ]);
  });

  it('among typed edits, keeps the earliest-start order', () => {
    expect(clusterEdits([e('b', 3, 9, true), e('a', 0, 6, true)])[0]?.primaryId).toBe('a');
  });

  it('breaks ties by longest span, then by id', () => {
    expect(clusterEdits([e('short', 0, 3), e('long', 0, 6)])[0]?.primaryId).toBe('long');
    expect(clusterEdits([e('z', 0, 3), e('a', 0, 3)])[0]?.primaryId).toBe('a');
  });
});
