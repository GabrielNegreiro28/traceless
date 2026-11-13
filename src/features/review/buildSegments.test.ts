import { describe, expect, it } from 'vitest';
import { findingOf } from '../../domain/rewrite/rewriteTestKit';
import { buildSegments } from './buildSegments';

const TEXT = 'I am the night lead at Dock B today';

function pieces(text: string, ...quotes: string[]) {
  const findings = quotes.map((q) => findingOf(text, q));
  return buildSegments(text, findings).map((s) => [s.text, s.findingIds.length]);
}

describe('buildSegments', () => {
  it('returns one plain segment when there are no findings', () => {
    expect(buildSegments(TEXT, [])).toEqual([
      { start: 0, end: TEXT.length, text: TEXT, findingIds: [] },
    ]);
  });

  it('returns no segments for an empty text', () => {
    expect(buildSegments('', [])).toEqual([]);
  });

  it('splits plain text around a finding and covers the whole text', () => {
    const segments = buildSegments(TEXT, [findingOf(TEXT, 'Dock B')]);
    expect(segments.map((s) => s.text)).toEqual(['I am the night lead at ', 'Dock B', ' today']);
    expect(segments.map((s) => s.text).join('')).toBe(TEXT);
    expect(segments[1]?.findingIds).toEqual(['t:23-29']);
  });

  it('handles a finding at the very start and at the very end', () => {
    expect(pieces(TEXT, 'I am')).toEqual([
      ['I am', 1],
      [' the night lead at Dock B today', 0],
    ]);
    expect(pieces(TEXT, 'today')).toEqual([
      ['I am the night lead at Dock B ', 0],
      ['today', 1],
    ]);
  });

  it('keeps adjacent findings as separate segments', () => {
    expect(pieces('abcdef', 'abc', 'def')).toEqual([
      ['abc', 1],
      ['def', 1],
    ]);
  });

  it('splits partly overlapping findings into three pieces', () => {
    expect(pieces('one two three', 'one two', 'two three')).toEqual([
      ['one ', 1],
      ['two', 2],
      [' three', 1],
    ]);
  });

  it('lists a nested finding first (narrowest first) inside its container', () => {
    const text = 'the night lead at Dock B';
    const outer = findingOf(text, 'night lead at Dock B');
    const inner = findingOf(text, 'Dock B');
    const last = buildSegments(text, [outer, inner]).at(-1);
    expect(last?.text).toBe('Dock B');
    expect(last?.findingIds).toEqual([inner.id, outer.id]);
  });

  it('shows two findings with the same span as one segment with both ids', () => {
    const a = findingOf(TEXT, 'Dock B', { id: 'a' });
    const b = findingOf(TEXT, 'Dock B', { id: 'b', category: 'ROLE_UNIQUE' });
    const seg = buildSegments(TEXT, [b, a]).find((s) => s.text === 'Dock B');
    expect(seg?.findingIds).toEqual(['a', 'b']);
  });

  it('is independent of the order of the findings', () => {
    const text = 'one two three';
    const a = findingOf(text, 'one two');
    const b = findingOf(text, 'two three');
    expect(buildSegments(text, [a, b])).toEqual(buildSegments(text, [b, a]));
  });

  it('clamps spans outside the text and ignores empty or inverted spans', () => {
    const past = { ...findingOf(TEXT, 'today'), span: { start: 30, end: 500 } };
    const empty = { ...findingOf(TEXT, 'Dock B'), id: 'empty', span: { start: 5, end: 5 } };
    const inverted = { ...findingOf(TEXT, 'Dock B'), id: 'inv', span: { start: 9, end: 3 } };
    const segments = buildSegments(TEXT, [past, empty, inverted]);
    const ids = segments.flatMap((s) => s.findingIds);
    expect(segments.map((s) => s.text).join('')).toBe(TEXT);
    expect(segments.at(-1)?.findingIds).toEqual([past.id]);
    expect(ids).toEqual([past.id]);
  });

  it('never splits an emoji (surrogate pair) at a span boundary', () => {
    const text = 'work \u{1F600} night';
    const emoji = text.indexOf('\u{1F600}');
    const cuts = { ...findingOf(text, 'work'), span: { start: 0, end: emoji + 1 } };
    const starts = {
      ...findingOf(text, 'night'),
      id: 'n',
      span: { start: emoji + 1, end: text.length },
    };
    const segments = buildSegments(text, [cuts, starts]);
    expect(segments.map((s) => s.text).join('')).toBe(text);
    for (const s of segments) expect(Array.from(s.text).join('')).toBe(s.text);
    expect(segments.map((s) => s.text)).toContain('\u{1F600}');
  });

  it('handles a finding that is exactly an emoji', () => {
    expect(pieces('a\u{1F600}b', '\u{1F600}')).toEqual([
      ['a', 0],
      ['\u{1F600}', 1],
      ['b', 0],
    ]);
  });
});
