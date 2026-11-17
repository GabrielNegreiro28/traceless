import type { RawCandidate } from '../../domain/detection/candidates/candidateTypes';
import { hasTag, type Sentence, type Token } from './taggedTokens';
import {
  candidateOf,
  closesPhrase,
  isHead,
  isNounish,
  isPersonWord,
  isTimeish,
  runEnd,
} from './tokenRuns';

const RANGE_OPENERS: Readonly<Record<string, ReadonlySet<string>>> = {
  between: new Set(['and']),
  from: new Set(['to', 'until', 'till', 'through']),
};
/** Words that quantify a time ("every Saturday", "most nights", "last spring"). */
const TIME_QUANTIFIERS = new Set(['every', 'each', 'most', 'last', 'this', 'next', 'all']);
const TIME_PREPOSITIONS = new Set([
  'at',
  'on',
  'in',
  'since',
  'until',
  'by',
  'during',
  'around',
  'over',
  'through',
  'before',
  'after',
]);
const PLACE_PREPOSITIONS = new Set([
  'on',
  'at',
  'in',
  'inside',
  'near',
  'behind',
  'outside',
  'across',
  'from',
  'to',
  'into',
  'off',
  'above',
  'below',
  'under',
  'beneath',
  'beside',
  'by',
  'past',
]);
const MAX_RANGE_WORDS = 3;
const MAX_PHRASE_WORDS = 4;

function isTimeWord(token: Token): boolean {
  return isTimeish(token) || isNounish(token);
}

/** "between midnight and six", "from 7 to 3": both ends of the range. */
function rangeAt(tokens: Sentence, i: number): RawCandidate | null {
  const closers = RANGE_OPENERS[(tokens[i] as Token).norm];
  if (closers === undefined) return null;
  const firstEnd = runEnd(tokens, i + 1, MAX_RANGE_WORDS, isTimeWord);
  const closer = tokens[firstEnd];
  if (firstEnd === i + 1 || closer === undefined || !closers.has(closer.norm)) return null;
  if (closesPhrase(tokens[firstEnd - 1] as Token)) return null;
  const end = runEnd(tokens, firstEnd + 1, MAX_RANGE_WORDS, isTimeWord);
  if (end === firstEnd + 1 || !tokens.slice(i + 1, end).some(isTimeish)) return null;
  return candidateOf(tokens, i, end, 'TIME_EXPRESSION');
}

/** Preposition or quantifier, optional determiner, then a short run of content words. */
function phraseEnd(tokens: Sentence, i: number): number {
  let at = i + 1;
  if (hasTag(tokens[at], 'Determiner') && !TIME_QUANTIFIERS.has(tokens[at]?.norm ?? '')) at += 1;
  const end = runEnd(tokens, at, MAX_PHRASE_WORDS, isTimeWord);
  return end > at ? end : i;
}

function timeOrPlaceAt(tokens: Sentence, i: number): RawCandidate | null {
  const opener = tokens[i] as Token;
  if (closesPhrase(opener)) return null;
  const isTimeOpener = TIME_QUANTIFIERS.has(opener.norm) || TIME_PREPOSITIONS.has(opener.norm);
  if (!isTimeOpener && !PLACE_PREPOSITIONS.has(opener.norm)) return null;
  const end = phraseEnd(tokens, i);
  const words = tokens.slice(i + 1, end);
  if (isTimeOpener && words.some(isTimeish)) return candidateOf(tokens, i, end, 'TIME_EXPRESSION');
  const place = words.some(isHead) && !isPersonWord(words.at(-1));
  if (PLACE_PREPOSITIONS.has(opener.norm) && place) {
    return candidateOf(tokens, i, end, 'PLACE_PHRASE');
  }
  return null;
}

/** Time ranges, time phrases and place phrases of one (writer) clause. */
export function timePlacePhrases(clause: Sentence): RawCandidate[] {
  return clause.flatMap((_, i) => rangeAt(clause, i) ?? timeOrPlaceAt(clause, i) ?? []);
}
