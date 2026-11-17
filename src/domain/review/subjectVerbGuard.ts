import type { Finding } from '../detection/types';

/**
 * Keeps "I <verb>" grammatical when a model suggestion drops the verb (pure). The cloud
 * model once offered "logs" for "sign the dock safety checklist" in "I sign the dock safety
 * checklist at the start of every shift", so accepting the card produced "I logs at the
 * start of every shift". When a quote starts right after the subject "I" or "we" and its
 * suggestion cannot start a verb phrase, the quote's own first word (the verb) is kept in
 * front of the suggestion: "I sign logs at the start of every shift".
 */

/** Words that start a noun phrase, never the verb a subject needs. */
const NOUN_PHRASE_STARTERS = new Set([
  'a',
  'an',
  'the',
  'some',
  'my',
  'our',
  'this',
  'that',
  'these',
  'those',
  'every',
  'each',
  'one',
  'several',
  'any',
]);

/** Words ending in "s" that may follow "I" ("I was", "I always"). */
const AFTER_I_ENDING_IN_S = new Set([
  'was',
  'always',
  'sometimes',
  'also',
  'perhaps',
  'thus',
  'nevertheless',
  'afterwards',
  'unless',
  'as',
]);

const SUBJECT_BEFORE = /(?:^|[^A-Za-z'])(I|[Ww]e)\s+$/;

function firstWord(value: string): string {
  return (value.trim().split(/\s+/)[0] ?? '').toLowerCase();
}

/** True when `word` cannot directly follow `subject` as its verb. */
function breaksSubjectVerb(subject: string, word: string): boolean {
  if (NOUN_PHRASE_STARTERS.has(word)) return true;
  return subject === 'I' && /^[a-z]+s$/.test(word) && !AFTER_I_ENDING_IN_S.has(word);
}

/**
 * The suggestion to apply for `finding` in `text`: unchanged unless it would leave the
 * subject before the quote without a verb, in which case the quote's first word is kept.
 */
export function keepSubjectVerb(text: string, finding: Finding): string | null {
  const { suggestion, quote, span } = finding;
  if (suggestion === null || suggestion.trim() === '') return suggestion;
  const subject = SUBJECT_BEFORE.exec(text.slice(0, span.start))?.[1];
  if (subject === undefined || !breaksSubjectVerb(subject, firstWord(suggestion))) {
    return suggestion;
  }
  const verb = quote.trim().split(/\s+/)[0] ?? '';
  if (verb === '' || breaksSubjectVerb(subject, verb.toLowerCase())) return suggestion;
  if (firstWord(suggestion) === verb.toLowerCase()) return suggestion;
  return `${verb} ${suggestion.trim()}`;
}
