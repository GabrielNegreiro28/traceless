/**
 * Self-description signatures (pure): a closing line that describes the writer instead of
 * naming them ("Thanks for listening,\nthe tired trainer on the night shift"). Colleagues
 * recognise such a line as easily as a name. Only called after a closing cue or a dash.
 */

export const MAX_DESCRIPTION_WORDS = 10;

const ARTICLE = /^(?:the|your|a|an)$/i;
const DEFINITE = /^(?:the|your)$/i;
/** Words that end the head noun phrase ("trainer [on] the night shift"). */
const PREPOSITION = /^(?:on|at|in|from|of|with|for|by|near)$/i;
/** Shift and rota words: they place the writer on a roster, whatever the head noun. */
const SHIFT_WORD =
  /(?:shift|^(?:nights?|overnights?|graveyard|weekends?|earlies|lates|evenings?|mornings?)$)/i;
/** Heads that say nothing about who the writer is ("a concerned employee", "a person"). */
const GENERIC_HEAD =
  /^(?:employee|employees|worker|workers|member|person|people|one|whistleblower|reporter|colleague|citizen|individual|friend|human)$/i;
/** Heads naming a group, not the writer ("the whole night shift team"). */
const GROUP_HEAD =
  /^(?:team|department|dept|staff|crew|group|management|committee|board|office|unit|everyone|everybody|all)$/i;
/** Pronouns, relatives and verbs that make the line a sentence about someone else. */
const SENTENCE_WORD =
  /^(?:he|she|him|her|his|they|them|it|who|which|that|what|is|was|are|were|did|does|do|knows|knew|saw|said|must|should|will|would|has|had|can|could)$/i;
const NAME_WORD = /^\p{Lu}\p{Ll}+[,.]?$/u;
const QUESTION_OR_EXCLAMATION = /[!?]$/;

function bare(word: string): string {
  return word.replace(/[,.;:]+$/, '');
}

/** The head noun: the last word before the first preposition (or the last word). */
function headOf(words: readonly string[]): string {
  const rest = words.slice(1);
  const cut = rest.findIndex((w) => PREPOSITION.test(w));
  return (cut <= 0 ? rest : rest.slice(0, cut)).at(-1) ?? '';
}

/** Two capitalized words in a row after the article look like a name ("Gary Pemberton"). */
function hasPersonName(words: readonly string[]): boolean {
  return words.some((w, i) => i > 1 && NAME_WORD.test(w) && NAME_WORD.test(words[i - 1] ?? ''));
}

function readsAsSentence(words: readonly string[], body: string): boolean {
  return QUESTION_OR_EXCLAMATION.test(body) || words.some((w) => SENTENCE_WORD.test(w));
}

/**
 * True for a short noun phrase about the writer: it starts with the/your/a/an, has no
 * person name, no verb or pronoun, and either a shift word or (after the/your) a specific
 * head noun. Group heads ("team") and generic heads after a/an ("A Concerned Employee")
 * are not signatures.
 */
export function isSelfDescription(rawWords: readonly string[], body: string): boolean {
  const words = rawWords.map(bare);
  if (words.length < 2 || words.length > MAX_DESCRIPTION_WORDS) return false;
  if (!ARTICLE.test(words[0] ?? '')) return false;
  if (hasPersonName(rawWords) || readsAsSentence(words, body)) return false;
  const head = headOf(words);
  if (GROUP_HEAD.test(head)) return false;
  if (words.some((w) => SHIFT_WORD.test(w))) return true;
  return DEFINITE.test(words[0] ?? '') && !GENERIC_HEAD.test(head);
}
