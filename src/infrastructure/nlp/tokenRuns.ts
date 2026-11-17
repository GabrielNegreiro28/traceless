import type { CandidateKind, RawCandidate } from '../../domain/detection/candidates/candidateTypes';
import { hasTag, type Sentence, type Token } from './taggedTokens';

/** Time words compromise tags as plain nouns ("midnight", "nights"). */
const TIME_NOUNS = new Set([
  'midnight',
  'noon',
  'morning',
  'mornings',
  'afternoon',
  'afternoons',
  'evening',
  'evenings',
  'night',
  'nights',
  'overnight',
  'overnights',
  'weekend',
  'weekends',
  'weekday',
  'weekdays',
  'shift',
  'shifts',
  'rotation',
  'spring',
  'summer',
  'fall',
  'autumn',
  'winter',
  'holidays',
  'am',
  'pm',
  'a.m',
  'p.m',
]);

/** Ends a phrase: the token's trailing punctuation closes it (a comma, a full stop…). */
export function closesPhrase(token: Token): boolean {
  return /[,;:.!?()"“”–—\n]/.test(token.post);
}

export function isTimeish(token: Token | undefined): boolean {
  if (token === undefined) return false;
  if (TIME_NOUNS.has(token.norm)) return true;
  return ['Date', 'Time', 'Duration', 'Value'].some((tag) => token.tags.has(tag));
}

/** Content words of a noun phrase: nouns (not pronouns), adjectives, numbers, hyphenated words. */
export function isNounish(token: Token | undefined): boolean {
  if (token === undefined || hasTag(token, 'Pronoun')) return false;
  if (hasTag(token, 'Noun') || hasTag(token, 'Adjective') || hasTag(token, 'Value')) return true;
  return hasTag(token, 'Hyphenated') || hasTag(token, 'Gerund');
}

/** A person: a name, a title or a role noun ("Dana", "Professor", "supervisor"). */
export function isPersonWord(token: Token | undefined): boolean {
  return hasTag(token, 'Person') || hasTag(token, 'Honorific') || hasTag(token, 'Actor');
}

/** A named person ("Dana Pike", "Professor Lind", or an unknown capitalised name). */
export function isNamedPerson(token: Token | undefined): boolean {
  return hasTag(token, 'Person') || hasTag(token, 'Honorific') || hasTag(token, 'ProperNoun');
}

export function isHead(token: Token | undefined): boolean {
  return hasTag(token, 'Noun') && !hasTag(token, 'Pronoun');
}

/**
 * Index just past a run of tokens matching `accept`, starting at `from`, at most `max` long;
 * the run stops after a token whose punctuation closes the phrase.
 */
export function runEnd(
  tokens: Sentence,
  from: number,
  max: number,
  accept: (token: Token) => boolean,
): number {
  let end = from;
  while (end < tokens.length && end - from < max && accept(tokens[end] as Token)) {
    end += 1;
    if (closesPhrase(tokens[end - 1] as Token)) break;
  }
  return end;
}

/** Candidate covering tokens[from, to) (exclusive); null for an empty range. */
export function candidateOf(
  tokens: Sentence,
  from: number,
  to: number,
  kind: CandidateKind,
): RawCandidate | null {
  const first = tokens[from];
  const last = tokens[to - 1];
  if (first === undefined || last === undefined || to <= from) return null;
  return { span: { start: first.start, end: last.end }, kind };
}
