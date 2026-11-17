import { isInReportedSpeech } from '../../domain/detection/firstPersonSpeech';
import { hasTag, type Sentence, type Token } from './taggedTokens';

/** Writer pronouns. Subjects open a first-person clause; the rest only anchor one. */
export const FIRST_PERSON_SUBJECTS = new Set(['i', 'we']);
export const FIRST_PERSON_POSSESSIVES = new Set(['my', 'our']);
const FIRST_PERSON_WORDS = new Set([
  ...FIRST_PERSON_SUBJECTS,
  ...FIRST_PERSON_POSSESSIVES,
  'me',
  'us',
  'mine',
  'ours',
  'myself',
  'ourselves',
]);
/**
 * Someone else as a subject: their clause describes them, not the writer. "You" (the reader:
 * "you can reach me at…") and "it" ("it was my first week") do not count.
 */
const OTHER_SUBJECTS = new Set(['he', 'she', 'they']);

/** Subordinators that open a new clause when compromise reads them as conjunctions. */
const SUBORDINATORS = new Set([
  'because',
  'while',
  'when',
  'whenever',
  'although',
  'though',
  'whereas',
  'if',
  'since',
  'after',
  'before',
  'until',
  'once',
]);
const COORDINATORS = new Set(['and', 'but', 'or', 'so']);
const CLAUSE_PUNCTUATION = /[,;:()–—]|\s-\s|\n/;

export function isWriterSubject(text: string, token: Token | undefined): boolean {
  if (token === undefined || !FIRST_PERSON_SUBJECTS.has(token.norm)) return false;
  return !isInReportedSpeech(text, token.start);
}

export function isWriterWord(text: string, token: Token): boolean {
  return FIRST_PERSON_WORDS.has(token.norm) && !isInReportedSpeech(text, token.start);
}

/** "and he…", "but we…": a coordinator followed by a new subject starts a clause. */
function opensClause(tokens: Sentence, i: number): boolean {
  const token = tokens[i] as Token;
  const next = tokens[i + 1];
  if (SUBORDINATORS.has(token.norm)) return hasTag(token, 'Conjunction') || hasTag(next, 'Pronoun');
  if (!COORDINATORS.has(token.norm)) return false;
  return hasTag(next, 'Pronoun') || hasTag(next, 'Determiner');
}

/** Only lead-in words so far ("Since right | after I…"): the subordinator joins them. */
function isLeadInOnly(current: readonly Token[]): boolean {
  return current.every((t) => hasTag(t, 'Adverb') || hasTag(t, 'Preposition'));
}

/**
 * Splits a sentence into clauses at clause punctuation (after the token) and before a
 * subordinator or a coordinator that introduces a new subject. Every token is kept.
 */
export function splitClauses(tokens: Sentence): Sentence[] {
  const clauses: Token[][] = [];
  let current: Token[] = [];
  tokens.forEach((token, i) => {
    if (current.length > 0 && !isLeadInOnly(current) && opensClause(tokens, i)) {
      clauses.push(current);
      current = [];
    }
    current.push(token);
    if (CLAUSE_PUNCTUATION.test(token.post)) {
      clauses.push(current);
      current = [];
    }
  });
  if (current.length > 0) clauses.push(current);
  return clauses;
}

/** The first pronoun subject of the clause belongs to someone other than the writer. */
function hasOtherSubjectFirst(text: string, clause: Sentence): boolean {
  for (const token of clause) {
    if (isWriterSubject(text, token)) return false;
    if (OTHER_SUBJECTS.has(token.norm) && hasTag(token, 'Pronoun')) return true;
  }
  return false;
}

/** A clause about the writer: a writer word outside quoted speech and no other subject first. */
export function isWriterClause(text: string, clause: Sentence): boolean {
  if (!clause.some((token) => isWriterWord(text, token))) return false;
  return !hasOtherSubjectFirst(text, clause);
}
