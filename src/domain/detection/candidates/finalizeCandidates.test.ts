import { describe, expect, it } from 'vitest';
import type { TextSpan } from '../types';
import { capCandidates } from './capCandidates';
import {
  CANDIDATE_WINDOW_CHARS,
  MAX_CANDIDATES,
  type CandidateKind,
  type RawCandidate,
} from './candidateTypes';
import { closingLines } from './closingLines';
import { dedupeCandidates } from './dedupeCandidates';
import { finalizeCandidates } from './finalizeCandidates';
import { trimCandidateSpan } from './trimCandidate';

function spanOf(text: string, phrase: string): TextSpan {
  const start = text.indexOf(phrase);
  if (start === -1) throw new Error('phrase not in text');
  return { start, end: start + phrase.length };
}

function raw(text: string, phrase: string, kind: CandidateKind): RawCandidate {
  return { span: spanOf(text, phrase), kind };
}

function sliceOf(text: string, span: TextSpan | null): string | null {
  return span === null ? null : text.slice(span.start, span.end);
}

describe('trimCandidateSpan', () => {
  const text = 'Well, and I restock the cold room for the, then left.';

  it('drops edge punctuation, whitespace and stopwords', () => {
    expect(
      sliceOf(
        text,
        trimCandidateSpan(text, spanOf(text, ', and I restock the cold room for the,')),
      ),
    ).toBe('I restock the cold room');
  });

  it('returns null when fewer than two words remain', () => {
    expect(trimCandidateSpan(text, spanOf(text, 'and I'))).toBeNull();
  });

  it('cuts the tail beyond twelve words', () => {
    const long = 'I sort the mail and file the forms and lock the side door every evening alone.';
    const trimmed = sliceOf(long, trimCandidateSpan(long, { start: 0, end: long.length }));
    expect(trimmed).toBe('I sort the mail and file the forms and lock the side');
  });

  it('keeps hyphenated words and contractions whole', () => {
    const t = "I'm the night-shift lead";
    expect(sliceOf(t, trimCandidateSpan(t, { start: 0, end: t.length }))).toBe(t);
  });
});

describe('dedupeCandidates', () => {
  const text = 'I cover the loading bay on weekends.';

  it('keeps the shorter near-duplicate with the better kind', () => {
    const result = dedupeCandidates([
      raw(text, 'I cover the loading bay on weekends', 'TEMPORAL_CLAUSE'),
      raw(text, 'cover the loading bay on weekends', 'FIRST_PERSON_CLAUSE'),
    ]);
    expect(result).toEqual([raw(text, 'cover the loading bay on weekends', 'TEMPORAL_CLAUSE')]);
  });

  it('keeps a container that adds a lot to a short contained candidate', () => {
    const result = dedupeCandidates([
      raw(text, 'I cover the loading bay on weekends', 'FIRST_PERSON_CLAUSE'),
      raw(text, 'on weekends', 'TIME_EXPRESSION'),
    ]);
    expect(result).toHaveLength(2);
  });

  it('merges exact duplicates', () => {
    const a = raw(text, 'the loading bay', 'PLACE_PHRASE');
    const b = raw(text, 'the loading bay', 'POSSESSIVE_PHRASE');
    expect(dedupeCandidates([a, b])).toEqual([b]);
  });
});

describe('capCandidates', () => {
  it('keeps at most MAX_CANDIDATES per window, preferring higher-priority kinds', () => {
    const many: RawCandidate[] = Array.from({ length: MAX_CANDIDATES + 5 }, (_, i) => ({
      span: { start: i * 10, end: i * 10 + 5 },
      kind: i === MAX_CANDIDATES + 4 ? 'TEMPORAL_CLAUSE' : 'PLACE_PHRASE',
    }));
    const kept = capCandidates(many);
    expect(kept).toHaveLength(MAX_CANDIDATES);
    expect(kept.some((c) => c.kind === 'TEMPORAL_CLAUSE')).toBe(true);
  });

  it('gives every window its own budget', () => {
    const inWindow = (window: number) =>
      Array.from({ length: MAX_CANDIDATES }, (_, i) => ({
        span: {
          start: window * CANDIDATE_WINDOW_CHARS + i * 10,
          end: window * CANDIDATE_WINDOW_CHARS + i * 10 + 5,
        },
        kind: 'PLACE_PHRASE' as const,
      }));
    expect(capCandidates([...inWindow(0), ...inWindow(1)])).toHaveLength(2 * MAX_CANDIDATES);
  });
});

describe('closingLines', () => {
  it('proposes short last lines and label lines', () => {
    const text =
      'Staff ID: QX-1\n\nI saw the logs being changed on several nights in a row.\n\nThanks,\nPat';
    const quotes = closingLines(text).map((c) => text.slice(c.span.start, c.span.end));
    expect(quotes).toEqual(['Staff ID: QX-1', 'Thanks,', 'Pat']);
  });

  it('ignores a single-line report', () => {
    expect(closingLines('Short report here.')).toEqual([]);
  });
});

describe('finalizeCandidates', () => {
  const text = 'Since my transfer, I run the night desk on the third floor.';
  const proposals: RawCandidate[] = [
    raw(text, 'I run the night desk on the third floor.', 'FIRST_PERSON_CLAUSE'),
    raw(text, 'my transfer,', 'POSSESSIVE_PHRASE'),
    raw(text, ' on the third floor', 'PLACE_PHRASE'),
    { span: { start: -3, end: 4 }, kind: 'PLACE_PHRASE' },
    { span: { start: 5, end: 500 }, kind: 'PLACE_PHRASE' },
  ];

  it('returns exact, trimmed slices ordered by position and drops invalid spans', () => {
    const result = finalizeCandidates(text, proposals);
    expect(result.map((c) => c.quote)).toEqual([
      'my transfer',
      'I run the night desk on the third floor',
      'on the third floor',
    ]);
    for (const c of result) expect(text.slice(c.span.start, c.span.end)).toBe(c.quote);
  });

  it('is independent of proposal order', () => {
    expect(finalizeCandidates(text, [...proposals].reverse())).toEqual(
      finalizeCandidates(text, proposals),
    );
  });
});
