import { describe, expect, it } from 'vitest';
import { mergeFindings } from './findingMerger';
import type { Finding } from './types';

/** RULE + MODEL collapse (docs/design/fase2-gate-iteration.md §G.3): origin RULE, model suggestion. */
function f(start: number, end: number, overrides: Partial<Finding> = {}): Finding {
  return {
    id: `model:${start}-${end}`,
    span: { start, end },
    quote: 'q',
    category: 'ROLE_UNIQUE',
    reason: 'model reason',
    suggestion: null,
    origin: 'MODEL',
    ...overrides,
  };
}

const rule = (start: number, end: number, overrides: Partial<Finding> = {}): Finding =>
  f(start, end, {
    id: `rule:${start}-${end}`,
    origin: 'RULE',
    reason: 'rule reason',
    suggestion: 'a member of the team',
    ...overrides,
  });

describe('mergeFindings: RULE and MODEL findings that collapse', () => {
  it('same span and category: keeps the RULE finding with the model suggestion', () => {
    const r = rule(4, 25);
    const m = f(4, 25, { suggestion: 'one of the porters', reason: 'a much longer model reason' });
    const expected = [{ ...r, suggestion: 'one of the porters' }];
    expect(mergeFindings([r, m])).toEqual(expected);
    expect(mergeFindings([m, r])).toEqual(expected);
  });

  it('keeps the rule suggestion when the model suggestion is empty (remove)', () => {
    const r = rule(4, 25);
    for (const suggestion of [null, '', '   ']) {
      expect(mergeFindings([f(4, 25, { suggestion }), r])).toEqual([r]);
    }
  });

  it('takes the best-quality model suggestion, whatever the input order', () => {
    const r = rule(0, 10);
    const short = f(0, 10, { id: 'm1', reason: 'short', suggestion: 'from short' });
    const long = f(0, 10, { id: 'm2', reason: 'the longer reason', suggestion: 'from long' });
    const silent = f(0, 10, { id: 'm3', reason: 'the longest reason of all', suggestion: null });
    const expected = [{ ...r, suggestion: 'from long' }];
    expect(mergeFindings([r, short, long, silent])).toEqual(expected);
    expect(mergeFindings([silent, long, short, r])).toEqual(expected);
    expect(mergeFindings([long, r, silent, short])).toEqual(expected);
  });

  it('a wider MODEL finding that swallows a RULE one keeps everything but becomes RULE', () => {
    const m = f(0, 25, { suggestion: "I'm one of the porters" });
    const merged = mergeFindings([rule(4, 25), m]);
    expect(merged).toEqual([{ ...m, origin: 'RULE' }]);
    const silent = f(0, 25);
    expect(mergeFindings([silent, rule(4, 25)])).toEqual([{ ...silent, origin: 'RULE' }]);
  });

  it('a RULE finding that swallows a narrower MODEL one keeps its own suggestion', () => {
    const r = rule(0, 25);
    expect(mergeFindings([f(10, 25, { suggestion: 'porter' }), r])).toEqual([r]);
  });

  it('keeps both on a partial overlap or across categories (no collapse)', () => {
    const r = rule(0, 10);
    const partial = f(5, 15, { suggestion: 'x' });
    expect(mergeFindings([partial, r])).toEqual([r, partial]);
    const otherCategory = f(0, 25, { category: 'SCHEDULE', suggestion: 'y' });
    expect(mergeFindings([otherCategory, r])).toEqual([r, otherCategory]);
  });

  it('core rules: only the suggestion of a same-span model finding moves', () => {
    const email = rule(8, 24, {
      category: 'DIRECT_IDENTIFIER',
      reason: 'An email address identifies a specific person.',
      suggestion: null,
    });
    const model = f(8, 24, { category: 'DIRECT_IDENTIFIER', suggestion: 'my work email' });
    expect(mergeFindings([model, email])).toEqual([{ ...email, suggestion: 'my work email' }]);
    const wider = f(0, 24, { category: 'DIRECT_IDENTIFIER' });
    expect(mergeFindings([wider, email])).toEqual([{ ...wider, origin: 'RULE' }]);
    const date = rule(30, 38, { category: 'PERSONAL_EVENT_DATE', suggestion: 'a recent date' });
    expect(mergeFindings([date, f(31, 36, { category: 'PERSONAL_EVENT_DATE' })])).toEqual([date]);
  });

  it('two RULE findings at one span never trade suggestions', () => {
    const a = rule(0, 10, { id: 'rule:a', reason: 'aaaa', suggestion: 'first' });
    const b = rule(0, 10, { id: 'rule:b', reason: 'bbbb', suggestion: 'second' });
    expect(mergeFindings([b, a])).toEqual([a]);
  });
});
