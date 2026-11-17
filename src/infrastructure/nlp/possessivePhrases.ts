import type { RawCandidate } from '../../domain/detection/candidates/candidateTypes';
import { FIRST_PERSON_POSSESSIVES, isWriterWord } from './clauses';
import { hasTag, type Sentence, type Token } from './taggedTokens';
import {
  candidateOf,
  closesPhrase,
  isHead,
  isNamedPerson,
  isNounish,
  isPersonWord,
  runEnd,
} from './tokenRuns';

/** Prepositions whose short phrase still describes the possessed thing ("our branch on…"). */
const MODIFIER_PREPOSITIONS = new Set([
  'of',
  'on',
  'at',
  'in',
  'from',
  'near',
  'for',
  'inside',
  'outside',
  'behind',
  'across',
  'by',
]);
const MAX_NOUN_WORDS = 5;
const MAX_MODIFIER_WORDS = 4;

/** "on the east side", "of the night crew": preposition, optional determiner, noun run. */
function modifierEnd(tokens: Sentence, from: number): number | null {
  const prep = tokens[from];
  if (prep === undefined || !MODIFIER_PREPOSITIONS.has(prep.norm)) return null;
  let at = from + 1;
  const det = tokens[at];
  if (hasTag(det, 'Determiner') || hasTag(det, 'Possessive')) at += 1;
  const end = runEnd(tokens, at, MAX_MODIFIER_WORDS, isNounish);
  const hasHead = tokens.slice(at, end).some(isHead);
  return end > at && hasHead ? end : null;
}

/**
 * "my supervisor", "our team leader Dana Pike", "our CTO, Vikram": the phrase names another
 * person (a role noun head, a name inside it, or a name right after it), not the writer.
 */
function namesSomeoneElse(tokens: Sentence, from: number, end: number): boolean {
  const words = tokens.slice(from, end);
  if (isPersonWord(words.at(-1)) || words.some((t) => hasTag(t, 'Person'))) return true;
  return isNamedPerson(tokens[end]);
}

/** my/our + noun phrase (+ a short prepositional modifier when the phrase is still open). */
function possessiveAt(text: string, tokens: Sentence, i: number): RawCandidate | null {
  const owner = tokens[i] as Token;
  if (!FIRST_PERSON_POSSESSIVES.has(owner.norm) || !isWriterWord(text, owner)) return null;
  if (closesPhrase(owner)) return null;
  const end = runEnd(tokens, i + 1, MAX_NOUN_WORDS, isNounish);
  if (end === i + 1 || !tokens.slice(i + 1, end).some(isHead)) return null;
  if (namesSomeoneElse(tokens, i + 1, end)) return null;
  const last = tokens[end - 1] as Token;
  const extended = closesPhrase(last) ? null : modifierEnd(tokens, end);
  return candidateOf(tokens, i, extended ?? end, 'POSSESSIVE_PHRASE');
}

/** Every writer possessive phrase in a sentence ("my night shifts", "our branch on the east side"). */
export function possessivePhrases(text: string, tokens: Sentence): RawCandidate[] {
  return tokens.flatMap((_, i) => possessiveAt(text, tokens, i) ?? []);
}
