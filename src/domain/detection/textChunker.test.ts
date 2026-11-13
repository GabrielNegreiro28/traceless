import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHUNK_CHARS,
  MIN_CHUNK_CHARS,
  chunkText,
  normalizeMaxChars,
  shiftFindings,
} from './textChunker';
import type { Finding } from './types';

const LONG_SENTENCE = 'word '.repeat(30).trim() + '.';

const INPUTS: readonly string[] = [
  'One paragraph only.',
  'First para.\n\nSecond para.\n\n\n  \nThird para here.',
  'Alpha beta gamma. Delta epsilon zeta! Eta theta iota? Kappa lambda mu. Nu xi omicron.',
  `${LONG_SENTENCE} ${LONG_SENTENCE}\n\nShort tail.`,
  'x'.repeat(95),
  '  leading space\n\ntrailing space  \n\n',
  'Line one\nline two same paragraph\n\nnext',
  'Emoji \u{1F600} text. \u{1F600}\u{1F600}\u{1F600}\u{1F600} more. End.',
  'CRLF one.\r\nstill one.\r\n\r\nCRLF two.\r\n\r\n\r\nthree',
  'run on line without any punctuation that keeps going and going '.repeat(5),
  '\u{1F600}'.repeat(30),
];

function nonWhitespace(s: string): string {
  return s.replace(/\s+/g, '');
}

describe('chunkText invariants', () => {
  for (const max of [2, 3, 7, 20, 50, 1000]) {
    for (const input of INPUTS) {
      it(`keeps exact offsets, limits and content (max=${max}, len=${input.length})`, () => {
        const chunks = chunkText(input, max);
        for (const chunk of chunks) {
          expect(input.slice(chunk.offset, chunk.offset + chunk.text.length)).toBe(chunk.text);
          expect(chunk.text.length).toBeLessThanOrEqual(max);
          expect(chunk.text.trim()).not.toBe('');
          expect(chunk.text).not.toMatch(/[\uD800-\uDBFF]$/);
          expect(chunk.text).not.toMatch(/^[\uDC00-\uDFFF]/);
        }
        expect(nonWhitespace(chunks.map((c) => c.text).join(''))).toBe(nonWhitespace(input));
        const offsets = chunks.map((c) => c.offset);
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      });
    }
  }
});

describe('chunkText behaviour', () => {
  it('returns no chunks for empty or whitespace-only text', () => {
    expect(chunkText('', 100)).toEqual([]);
    expect(chunkText(' \n\n \t', 100)).toEqual([]);
  });

  it('keeps a short text in one chunk', () => {
    expect(chunkText('Hello there.', 100)).toEqual([{ text: 'Hello there.', offset: 0 }]);
  });

  it('packs paragraphs greedily and splits on paragraph boundaries', () => {
    expect(chunkText('aaaa\n\nbbbb\n\ncccc', 10)).toEqual([
      { text: 'aaaa\n\nbbbb', offset: 0 },
      { text: 'cccc', offset: 12 },
    ]);
  });

  it('recognizes CRLF paragraph boundaries', () => {
    expect(chunkText('aaaa\r\n\r\nbbbb\r\n\r\ncccc', 6).map((c) => c.text)).toEqual([
      'aaaa',
      'bbbb',
      'cccc',
    ]);
  });

  it('splits an oversized paragraph on sentence boundaries', () => {
    expect(chunkText('One two. Three four. Five six.', 21).map((c) => c.text)).toEqual([
      'One two. Three four. ',
      'Five six.',
    ]);
  });

  it('splits an oversized paragraph at single newlines before sentences', () => {
    expect(chunkText('first line. more\nsecond line\nthird', 17).map((c) => c.text)).toEqual([
      'first line. more\n',
      'second line\nthird',
    ]);
  });

  it('backs off to the last whitespace when hard-splitting a run-on line', () => {
    expect(chunkText('alpha beta gamma delta', 12).map((c) => c.text)).toEqual([
      'alpha beta ',
      'gamma delta',
    ]);
  });

  it('hard-splits a single long word mid-word', () => {
    expect(chunkText('abcdefghij', 4).map((c) => c.text)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('never splits a surrogate pair', () => {
    const chunks = chunkText('ab\u{1F600}cd', 3).map((c) => c.text);
    expect(chunks).toEqual(['ab', '\u{1F600}c', 'd']);
  });

  it('drops whitespace-only pieces created by hard splits', () => {
    const chunks = chunkText(`word${' '.repeat(40)}end`, 10);
    expect(chunks.every((c) => c.text.trim() !== '')).toBe(true);
    expect(chunks.map((c) => c.text.trim())).toEqual(['word', 'end']);
  });
});

describe('maxChars guard', () => {
  it('falls back to the default for NaN, zero, negative and -Infinity limits', () => {
    for (const bad of [Number.NaN, 0, 0.5, -5, -Infinity]) {
      expect(normalizeMaxChars(bad)).toBe(DEFAULT_CHUNK_CHARS);
    }
    expect(DEFAULT_CHUNK_CHARS).toBe(6000);
  });

  it('floors fractions and clamps small positive limits to the minimum', () => {
    expect(normalizeMaxChars(1)).toBe(MIN_CHUNK_CHARS);
    expect(normalizeMaxChars(2.9)).toBe(2);
    expect(normalizeMaxChars(10.7)).toBe(10);
  });

  it('never yields a whitespace-only chunk (NBSP-only line)', () => {
    const chunks = chunkText('aaaa bbbb\n \ncccc dddd', 5);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) expect(chunk.text.trim()).not.toBe('');
  });

  it('treats Infinity as "never split"', () => {
    const text = 'a. '.repeat(100);
    expect(chunkText(text, Infinity)).toHaveLength(1);
  });

  it('still chunks safely with a fallback or clamped limit', () => {
    expect(chunkText('abcd', Number.NaN).map((c) => c.text)).toEqual(['abcd']);
    expect(chunkText('abcd', -1).map((c) => c.text)).toEqual(['abcd']);
    expect(chunkText('abcd', 1).map((c) => c.text)).toEqual(['ab', 'cd']);
  });
});

describe('shiftFindings', () => {
  const base: Finding = {
    id: 'model:0-4:LOCATION',
    span: { start: 0, end: 4 },
    quote: 'ward',
    category: 'LOCATION',
    reason: 'r',
    suggestion: null,
    origin: 'MODEL',
  };

  it('shifts spans and rebuilds ids per origin', () => {
    const rule: Finding = {
      ...base,
      id: 'rule:0-4',
      origin: 'RULE',
      category: 'DIRECT_IDENTIFIER',
    };
    const [m, r] = shiftFindings([base, rule], 100);
    expect(m?.span).toEqual({ start: 100, end: 104 });
    expect(m?.id).toBe('model:100-104:LOCATION');
    expect(r?.id).toBe('rule:100-104');
  });

  it('does not mutate the input', () => {
    shiftFindings([base], 5);
    expect(base.span).toEqual({ start: 0, end: 4 });
  });

  it('returns empty for empty input', () => {
    expect(shiftFindings([], 5)).toEqual([]);
  });
});
