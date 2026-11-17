import type { RawCandidate } from '../../domain/detection/candidates/candidateTypes';
import { isWriterSubject, isWriterWord } from './clauses';
import { hasTag, type Sentence, type Token } from './taggedTokens';
import { candidateOf, isNamedPerson } from './tokenRuns';

/**
 * Verbs and states that frame the report instead of describing the writer ("I know…",
 * "I heard him say…", "I'm scared"): their clauses are noise for the verifier.
 */
const FRAMING_WORDS = new Set([
  'know',
  'knew',
  'think',
  'thought',
  'believe',
  'feel',
  'felt',
  'found',
  'hear',
  'heard',
  'see',
  'saw',
  'seen',
  'watch',
  'watched',
  'counted',
  'estimate',
  'notice',
  'noticed',
  'want',
  'wanted',
  'hope',
  'guess',
  'wonder',
  'remember',
  'realize',
  'realized',
  'understand',
  'decided',
  'said',
  'told',
  'reported',
  'reporting',
  'report',
  'mentioned',
  'worry',
  'worried',
  'afraid',
  'scared',
  'nervous',
  'sure',
  'sorry',
  'concerned',
]);
/** Words between the subject and its main verb: auxiliaries, negation, adverbs. */
function isVerbLeadIn(token: Token): boolean {
  if (hasTag(token, 'Auxiliary') || hasTag(token, 'Copula') || hasTag(token, 'Adverb')) return true;
  return hasTag(token, 'Negative') || hasTag(token, 'Modal');
}

function isFramingClause(clause: Sentence, subject: number): boolean {
  const main = clause.slice(subject + 1).find((token) => !isVerbLeadIn(token));
  return main !== undefined && FRAMING_WORDS.has(main.norm);
}

/** "I maintain the map", "we are usually the only two on nights": subject to clause end. */
export function firstPersonClause(text: string, clause: Sentence): RawCandidate[] {
  const subject = clause.findIndex((token) => isWriterSubject(text, token));
  if (subject === -1 || isFramingClause(clause, subject)) return [];
  const candidate = candidateOf(clause, subject, clause.length, 'FIRST_PERSON_CLAUSE');
  return candidate === null ? [] : [candidate];
}

const WRITER_OBJECTS = new Set(['me', 'us']);

/**
 * A writer clause without a writer subject but with "me"/"us" ("there are only two of us
 * on dispatch", "the drivers come to me", "text me at…"): the whole clause.
 */
export function writerObjectClause(text: string, clause: Sentence): RawCandidate[] {
  if (clause.some((token) => isWriterSubject(text, token))) return [];
  const anchor = clause.findIndex((t) => WRITER_OBJECTS.has(t.norm) && isWriterWord(text, t));
  // "Dana Pike tells us to…": a named person acting on the writer is about that person.
  const named = clause.slice(0, Math.max(anchor, 0)).some(isNamedPerson);
  const candidate =
    anchor === -1 || named ? null : candidateOf(clause, 0, clause.length, 'FIRST_PERSON_CLAUSE');
  return candidate === null ? [] : [candidate];
}

const RELATIVE_OPENERS = new Set(['which', 'who', 'where', 'whose']);

/** "…the stability group, which is just four people": a relative clause after a writer clause. */
export function relativeContinuation(clause: Sentence): RawCandidate[] {
  if (!RELATIVE_OPENERS.has(clause[0]?.norm ?? '')) return [];
  const candidate = candidateOf(clause, 0, clause.length, 'FIRST_PERSON_CLAUSE');
  return candidate === null ? [] : [candidate];
}
