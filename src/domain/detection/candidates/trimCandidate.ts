import type { TextSpan } from '../types';
import { MAX_CANDIDATE_WORDS, MIN_CANDIDATE_WORDS } from './candidateTypes';

/** Words that add nothing at a candidate's edge ("and I cover…", "…the shift of the"). */
const LEADING_STOPWORDS = new Set(['and', 'but', 'or', 'so', 'then', 'also', 'that', 'which']);
const TRAILING_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'of',
  'to',
  'at',
  'in',
  'on',
  'for',
  'with',
  'from',
  'by',
  'as',
  'that',
  'which',
  'who',
]);

const WORD = /[\p{L}\p{N}]+(?:['’\-.][\p{L}\p{N}]+)*/gu;

interface Word {
  readonly start: number;
  readonly end: number;
  readonly lower: string;
}

function wordsIn(text: string, span: TextSpan): Word[] {
  const slice = text.slice(span.start, span.end);
  return Array.from(slice.matchAll(WORD), (m) => ({
    start: span.start + m.index,
    end: span.start + m.index + m[0].length,
    lower: m[0].toLowerCase(),
  }));
}

function dropEdgeStopwords(words: Word[]): Word[] {
  let first = 0;
  let last = words.length - 1;
  while (first <= last && LEADING_STOPWORDS.has((words[first] as Word).lower)) first += 1;
  while (last >= first && TRAILING_STOPWORDS.has((words[last] as Word).lower)) last -= 1;
  return words.slice(first, last + 1);
}

/**
 * Tightens a rough span to whole words: no edge whitespace, punctuation or stopwords, and at
 * most MAX_CANDIDATE_WORDS words (the tail is cut). Null when fewer than MIN_CANDIDATE_WORDS
 * words remain. Pure; the result is always inside the input span.
 */
export function trimCandidateSpan(text: string, span: TextSpan): TextSpan | null {
  let words = dropEdgeStopwords(wordsIn(text, span));
  if (words.length > MAX_CANDIDATE_WORDS) {
    words = dropEdgeStopwords(words.slice(0, MAX_CANDIDATE_WORDS));
  }
  if (words.length < MIN_CANDIDATE_WORDS) return null;
  return { start: (words[0] as Word).start, end: (words.at(-1) as Word).end };
}
