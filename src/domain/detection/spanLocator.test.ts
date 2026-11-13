import { describe, expect, it } from 'vitest';
import { toRawText } from '../text/brandedText';
import { findAllOccurrences, locateModelFindings, normalizeWithMap } from './spanLocator';
import type { ModelFinding } from './types';

function mf(quote: string, category: ModelFinding['category'] = 'ROLE_UNIQUE'): ModelFinding {
  return { quote, category, reason: 'r', suggestion: 's' };
}

function locate(text: string, ...findings: ModelFinding[]) {
  return locateModelFindings(toRawText(text), findings);
}

describe('findAllOccurrences', () => {
  it('finds non-overlapping occurrences', () => {
    expect(findAllOccurrences('aaaa', 'aa')).toEqual([0, 2]);
    expect(findAllOccurrences('abcabc', 'bc')).toEqual([1, 4]);
  });

  it('returns nothing for empty or missing needles', () => {
    expect(findAllOccurrences('abc', '')).toEqual([]);
    expect(findAllOccurrences('abc', 'z')).toEqual([]);
  });
});

describe('normalizeWithMap', () => {
  it('collapses whitespace, lowercases and maps back to original offsets', () => {
    const n = normalizeWithMap('A  \n b');
    expect(n.text).toBe('a b');
    expect(n.origins[1]).toEqual({ start: 1, end: 5 });
  });

  it('folds curly quotes, dashes and ellipsis', () => {
    expect(normalizeWithMap('“hi” ‘x’').text).toBe('"hi" \'x\'');
    expect(normalizeWithMap('a–b—c').text).toBe('a-b-c');
    expect(normalizeWithMap('wait…').text).toBe('wait...');
  });

  it('maps every expanded char to its single source char', () => {
    const n = normalizeWithMap('…');
    expect(n.origins).toHaveLength(3);
    expect(n.origins.every((o) => o.start === 0 && o.end === 1)).toBe(true);
  });
});

describe('locateModelFindings', () => {
  const text = 'I am the only night-shift nurse on the ward.';

  it('locates an exact quote', () => {
    const [f] = locate(text, mf('night-shift nurse'));
    expect(f).toMatchObject({
      span: { start: 14, end: 31 },
      quote: 'night-shift nurse',
      origin: 'MODEL',
      id: 'model:14-31:ROLE_UNIQUE',
      reason: 'r',
      suggestion: 's',
    });
  });

  it('marks every occurrence', () => {
    const found = locate('the ward, the ward', mf('the ward', 'LOCATION'));
    expect(found.map((f) => f.span)).toEqual([
      { start: 0, end: 8 },
      { start: 10, end: 18 },
    ]);
    expect(found[0]?.id).not.toBe(found[1]?.id);
  });

  it('finds case variants alongside exact matches', () => {
    const found = locate('Night shift starts. I am on night shift.', mf('night shift'));
    expect(found.map((f) => f.quote)).toEqual(['Night shift', 'night shift']);
  });

  it('gives 2 findings for "Nurse and nurse"', () => {
    expect(locate('Nurse and nurse', mf('nurse')).map((f) => f.span)).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 15 },
    ]);
  });

  it('matches whitespace differences and maps to original offsets', () => {
    const [f] = locate('He said:   Night\n Shift  only.', mf('night shift'));
    expect(f?.quote).toBe('Night\n Shift');
    expect(f?.span).toEqual({ start: 11, end: 23 });
  });

  it('matches curly vs straight quotes, dashes and ellipsis', () => {
    const [quoted] = locate('She said “don’t tell” twice', mf('"don\'t tell"'));
    expect(quoted?.quote).toBe('“don’t tell”');
    const [dash] = locate('the night–shift crew', mf('night-shift'));
    expect(dash?.quote).toBe('night–shift');
    const [dots] = locate('and then… silence', mf('and then...'));
    expect(dots?.quote).toBe('and then');
  });

  it('ignores trailing punctuation on the quote', () => {
    const [f] = locate('I was the night nurse on duty', mf('night nurse.'));
    expect(f?.quote).toBe('night nurse');
  });

  it('does not match inside longer words', () => {
    expect(locate('toward the award', mf('ward'))).toEqual([]);
    expect(locate('the ward and toward', mf('ward')).map((f) => f.span.start)).toEqual([4]);
    expect(locate('naive café', mf('caf'))).toEqual([]);
    expect(locate('a1b2 b12', mf('b1'))).toEqual([]);
  });

  it('allows adjacent punctuation and non-word quote edges', () => {
    expect(locate('(ward), ward.', mf('ward'))).toHaveLength(2);
    expect(locate('xa#4471', mf('#4471'))).toHaveLength(1);
    expect(locate('x\u{1F600}ward', mf('ward'))).toHaveLength(1);
  });

  it('rejects quotes shorter than 2 non-space characters', () => {
    expect(locate('a b a c', mf('a'))).toEqual([]);
    expect(locate('a b a c', mf(' a '))).toEqual([]);
    expect(locate('a b', mf('.'))).toEqual([]);
    expect(locate('go on', mf('go'))).toHaveLength(1);
  });

  it('discards hallucinated quotes', () => {
    expect(locate(text, mf('the surgeon'))).toEqual([]);
  });

  it('discards empty and whitespace-only quotes', () => {
    expect(locate(text, mf(''), mf('   \n'))).toEqual([]);
  });

  it('collapses identical model findings', () => {
    expect(locate(text, mf('ward', 'LOCATION'), mf('ward', 'LOCATION'))).toHaveLength(1);
  });

  it('keeps the same quote under different categories', () => {
    const found = locate(text, mf('ward', 'LOCATION'), mf('ward', 'TEAM_SIZE'));
    expect(found.map((f) => f.category)).toEqual(['LOCATION', 'TEAM_SIZE']);
  });

  it('handles empty input', () => {
    expect(locate('', mf('xx'))).toEqual([]);
    expect(locate(text)).toEqual([]);
  });
});
