/**
 * First-person singular tokens: I (also I'm, I've, I'd, I'll, which split at the
 * apostrophe), me, my, mine, myself, plus the apostrophe-less "im"/"ive" of run-on
 * writing. Case-insensitive and word-bounded, so "Mine" counts but "time" does not.
 */
const FIRST_PERSON_SINGULAR = /\b(?:i|im|ive|me|my|mine|myself)\b/i;

/**
 * True when `text` speaks as the writer. The post-filters never suppress such a finding:
 * a detail the writer states about themselves always stays visible (safety rule).
 */
export function hasFirstPersonSingular(text: string): boolean {
  return FIRST_PERSON_SINGULAR.test(text);
}

/** First-person plural tokens: we, us, our, ours, ourselves (case-insensitive, word-bounded). */
const FIRST_PERSON_PLURAL = /\b(?:we|us|our|ours|ourselves)\b/i;

/**
 * True when `text` includes the writer's group ("They put only two of us on the desk").
 * Used only by the third-person filter: a protected person may still be "our manager".
 */
export function hasFirstPersonPlural(text: string): boolean {
  return FIRST_PERSON_PLURAL.test(text);
}
