import { describe, expect, it } from 'vitest';
import { mergeFindings } from './findingMerger';
import type { Finding } from './types';

function f(start: number, end: number, overrides: Partial<Finding> = {}): Finding {
  return {
    id: `x:${start}-${end}`,
    span: { start, end },
    quote: 'q',
    category: 'LOCATION',
    reason: 'reason',
    suggestion: null,
    origin: 'MODEL',
    ...overrides,
  };
}

describe('mergeFindings', () => {
  it('returns empty for empty input', () => {
    expect(mergeFindings([])).toEqual([]);
  });

  it('sorts by start, then end', () => {
    const merged = mergeFindings([
      f(10, 12),
      f(0, 5, { category: 'SCHEDULE' }),
      f(0, 3, { category: 'TEAM_SIZE' }),
    ]);
    expect(merged.map((x) => [x.span.start, x.span.end])).toEqual([
      [0, 3],
      [0, 5],
      [10, 12],
    ]);
  });

  it('prefers RULE over MODEL for the same span and category', () => {
    const rule = f(0, 5, { origin: 'RULE', id: 'rule:0-5', reason: 'a' });
    const model = f(0, 5, { reason: 'a much longer reason' });
    expect(mergeFindings([model, rule])).toEqual([rule]);
    expect(mergeFindings([rule, model])).toEqual([rule]);
  });

  it('keeps the more specific reason between same-origin duplicates', () => {
    const short = f(0, 5, { reason: 'short', id: 'a' });
    const long = f(0, 5, { reason: 'a more specific reason', id: 'b' });
    expect(mergeFindings([short, long])).toEqual([long]);
    expect(mergeFindings([long, short])).toEqual([long]);
  });

  it('breaks full ties on reason text, then id, regardless of order', () => {
    const a = f(0, 5, { reason: 'aaaa', id: 'a' });
    const b = f(0, 5, { reason: 'bbbb', id: 'b' });
    expect(mergeFindings([a, b])).toEqual([a]);
    expect(mergeFindings([b, a])).toEqual([a]);
    const c = f(0, 5, { reason: 'same', id: 'c' });
    const d = f(0, 5, { reason: 'same', id: 'd' });
    expect(mergeFindings([d, c])).toEqual([c]);
    expect(mergeFindings([c, d])).toEqual([c]);
  });

  it('keeps one finding per category when spans are identical', () => {
    const location = f(0, 5, { category: 'LOCATION' });
    const schedule = f(0, 5, { category: 'SCHEDULE' });
    expect(mergeFindings([schedule, location]).map((x) => x.category)).toEqual([
      'LOCATION',
      'SCHEDULE',
    ]);
    expect(mergeFindings([location, schedule]).map((x) => x.category)).toEqual([
      'LOCATION',
      'SCHEDULE',
    ]);
  });

  it('drops a finding contained in a larger one of the same category', () => {
    const big = f(0, 20);
    const small = f(5, 10);
    const sameStart = f(0, 4);
    const sameEnd = f(15, 20);
    expect(mergeFindings([small, sameStart, big, sameEnd])).toEqual([big]);
  });

  it('keeps both when containment crosses categories', () => {
    const big = f(0, 20);
    const small = f(5, 10, { category: 'SCHEDULE' });
    expect(mergeFindings([small, big])).toEqual([big, small]);
  });

  it('keeps both on partial overlap with different categories', () => {
    const a = f(0, 10);
    const b = f(5, 15, { category: 'TEAM_SIZE' });
    expect(mergeFindings([b, a])).toEqual([a, b]);
  });

  it('keeps both on partial overlap with the same category', () => {
    const a = f(0, 10);
    const b = f(5, 15);
    expect(mergeFindings([b, a])).toEqual([a, b]);
  });

  it('keeps disjoint findings untouched', () => {
    const a = f(0, 2);
    const b = f(4, 6);
    expect(mergeFindings([b, a])).toEqual([a, b]);
  });

  it('collapses exact duplicates to a single finding', () => {
    expect(mergeFindings([f(0, 2), f(0, 2)])).toHaveLength(1);
  });

  it('sorts disjoint findings by position even when ids sort the other way', () => {
    const merged = mergeFindings([f(3, 4, { id: 'b' }), f(0, 1, { id: 'a' })]);
    expect(merged.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('gives identical output for every input permutation', () => {
    const input = [
      f(0, 10, { id: 'm1', reason: 'long reason here' }),
      f(0, 10, { id: 'r1', origin: 'RULE', reason: 'x' }),
      f(0, 10, { id: 'm2', category: 'SCHEDULE', reason: 'abc' }),
      f(0, 10, { id: 'm3', category: 'SCHEDULE', reason: 'abd' }),
      f(2, 5, { id: 'm4' }),
      f(8, 14, { id: 'm5', category: 'TEAM_SIZE' }),
      f(8, 14, { id: 'm6', category: 'TEAM_SIZE' }),
    ];
    const expected = mergeFindings(input);
    const permutations = [
      [...input].reverse(),
      [input[3]!, input[5]!, input[0]!, input[6]!, input[2]!, input[1]!, input[4]!],
      [input[6]!, input[4]!, input[2]!, input[0]!, input[1]!, input[3]!, input[5]!],
      [input[1]!, input[0]!, input[3]!, input[2]!, input[6]!, input[5]!, input[4]!],
    ];
    for (const permutation of permutations) {
      expect(mergeFindings(permutation)).toEqual(expected);
    }
    expect(expected.map((x) => x.id)).toEqual(['r1', 'm2', 'm5']);
  });

  it('does not mutate its input', () => {
    const input = [f(10, 12), f(0, 3)];
    const copy = [...input];
    mergeFindings(input);
    expect(input).toEqual(copy);
  });
});
