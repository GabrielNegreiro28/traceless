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

  it('keeps both across categories (no collapse)', () => {
    const r = rule(0, 10);
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

describe('mergeFindings: same-category partial overlaps (sample walkthrough regression)', () => {
  const text = 'I work Tuesday to Saturday, from 10 p.m. to 6 a.m., and I sign.';
  const at = (quote: string) => ({
    start: text.indexOf(quote),
    end: text.indexOf(quote) + quote.length,
  });
  const ruleQuote = 'work Tuesday';
  const modelQuote = 'Tuesday to Saturday, from 10 p.m. to 6 a.m';
  const schedule = { category: 'SCHEDULE' as const };
  const r = rule(at(ruleQuote).start, at(ruleQuote).end, {
    ...schedule,
    quote: ruleQuote,
    suggestion: 'work some shifts',
  });
  const m = f(at(modelQuote).start, at(modelQuote).end, {
    ...schedule,
    quote: modelQuote,
    suggestion: 'some days',
  });

  it('shows one card over the union, origin RULE, with the rule suggestion', () => {
    const union = 'work Tuesday to Saturday, from 10 p.m. to 6 a.m';
    expect(mergeFindings([m, r])).toEqual([
      {
        ...r,
        id: `rule:${at(union).start}-${at(union).end}`,
        span: at(union),
        quote: union,
        suggestion: 'work some shifts',
      },
    ]);
    expect(mergeFindings([r, m])).toEqual(mergeFindings([m, r]));
  });

  it('chains three overlapping findings into one', () => {
    const tail = '6 a.m., and';
    const extra = f(at(tail).start, at(tail).end, { ...schedule, quote: tail, suggestion: 'z' });
    const [only, ...rest] = mergeFindings([extra, m, r]);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({
      quote: 'work Tuesday to Saturday, from 10 p.m. to 6 a.m., and',
      origin: 'RULE',
    });
  });

  it('takes a MODEL suggestion only when the model finding covers the union', () => {
    const left = f(0, 6, { ...schedule, id: 'model:a', quote: text.slice(0, 6), suggestion: 'a' });
    const wide = f(2, 14, {
      ...schedule,
      id: 'model:b',
      quote: text.slice(2, 14),
      suggestion: 'b',
    });
    const [only] = mergeFindings([left, wide]);
    expect(only).toMatchObject({
      span: { start: 0, end: 14 },
      quote: text.slice(0, 14),
      origin: 'MODEL',
    });
  });
});
