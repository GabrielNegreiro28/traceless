import type { TextSpan } from './types';

const wordSet = (...lists: string[]): ReadonlySet<string> => new Set(lists.join(' ').split(' '));

/** Honorifics: the tokens after one are a name ("Dr. Jane Ruiz"). Compared lower-case. */
const HONORIFICS = wordSet('mr ms mrs mx dr prof professor coach miss sir madam');

/** Job titles that introduce a name ("Site Manager Gary Holt", "Sister Jones"). */
const TITLES = wordSet(
  'manager director supervisor officer assistant deputy head chief lead nurse doctor',
  'captain sergeant chef judge mayor inspector detective principal president owner',
  'father sister brother pastor ceo cfo cto coo vp',
);

/** Place, organisation and department words: a run holding one is not a person's name. */
const PLACE_WORDS = wordSet(
  'office unit floor building branch company group center centre division board city',
  'county state street road avenue depot ward wing hall station plant warehouse store shop',
  'hospital school clinic site park lane square bank department team annex campus factory',
  'yard mill lab kitchen hotel club church farm port terminal tower court accounts payroll',
  'finance sales marketing operations legal security reception facilities purchasing',
);

/** Capitalised words that are never names: sentence starters, pronouns, days, months. */
const NOT_NAMES = wordSet(
  'the and but for with from our their his her its this that these those she they you',
  'who whom whose when where what which then there after before since also every each',
  'some all any one two three not someone somebody everyone everybody anyone nobody',
  'monday tuesday wednesday thursday friday saturday sunday january february march',
  'april june july august september october november december night day morning',
  'evening weekend senior junior general staff north south east west',
);

const MIN_NAME_CHARS = 3;
/** Acronyms such as CTO or HR are roles, not names: a name has a lower-case letter. */
const HAS_LOWER = /\p{Ll}/u;
const LEADING_NON_LETTERS = /^[^\p{L}]+/u;
const TRAILING_POSSESSIVE = /(?:['’]s)?[^\p{L}]*$/u;
/** A comma, semicolon, colon or bracket ends a capitalised run ("the bursar, Leo Amadi"). */
const RUN_BREAK = /[,;:()[\]]$/;

/** A word without surrounding punctuation or a possessive "'s". */
function core(word: string): string {
  return word.replace(LEADING_NON_LETTERS, '').replace(TRAILING_POSSESSIVE, '');
}

const isTitle = (token: string) =>
  HONORIFICS.has(token.toLowerCase()) || TITLES.has(token.toLowerCase());

function isNameToken(token: string): boolean {
  const lower = token.toLowerCase();
  if (token.length < MIN_NAME_CHARS || !HAS_LOWER.test(token)) return false;
  return !NOT_NAMES.has(lower) && !PLACE_WORDS.has(lower) && !isTitle(token);
}

/** Runs of consecutive capitalised words (cores), split at lower-case words and commas. */
function capitalisedRuns(quote: string): string[][] {
  const runs: string[][] = [];
  let current: string[] = [];
  for (const word of quote.split(/\s+/)) {
    const token = core(word);
    if (/^\p{Lu}/u.test(token)) current.push(token);
    if (!/^\p{Lu}/u.test(token) || RUN_BREAK.test(word)) {
      if (current.length > 0) runs.push(current);
      current = [];
    }
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

/**
 * Names in one run: the (up to 2) tokens after its last honorific or title; otherwise,
 * for the quote's final run only, its last 1-2 tokens when no place word is in it.
 */
function runNames(run: readonly string[], isFinal: boolean): string[] {
  const lastTitle = run.findLastIndex(isTitle);
  if (lastTitle >= 0) return run.slice(lastTitle + 1, lastTitle + 3).filter(isNameToken);
  if (!isFinal || run.some((t) => PLACE_WORDS.has(t.toLowerCase()))) return [];
  return run.slice(-2).filter(isNameToken);
}

/**
 * Name tokens of a protected quote (design §B.3, narrowed after review): only tokens
 * that follow an honorific or job title, or the last 1-2 tokens of the final capitalised
 * run (the "[title], [Name]" introduction). "Site Manager Gary Holt" yields Gary, Holt;
 * "Riverside Depot" and "Sister Jones on Ward 7"'s "Ward" yield nothing.
 */
export function extractNameTokens(quote: string): string[] {
  const runs = capitalisedRuns(quote);
  return runs.flatMap((run, i) => runNames(run, i === runs.length - 1));
}

/**
 * The capitalised run a quote starts with, after an optional honorific, ending at the
 * first lower-case word or comma: "Mr. Wade had" → [Wade], "Tom Alvarez works" →
 * [Tom, Alvarez], "Jordan Street branch" → [Jordan, Street], "the only…" → [].
 */
export function leadingRun(quote: string): string[] {
  const words = quote.trim().split(/\s+/);
  const skip = HONORIFICS.has(core(words[0] ?? '').toLowerCase()) ? 1 : 0;
  const run: string[] = [];
  for (const word of words.slice(skip)) {
    const token = core(word);
    if (!/^\p{Lu}/u.test(token)) break;
    run.push(token);
    if (RUN_BREAK.test(word)) break;
  }
  return run;
}

const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}

/** Case-sensitive, word-bounded occurrences of `token` in `text`. */
export function findTokenSpans(text: string, token: string): TextSpan[] {
  const spans: TextSpan[] = [];
  if (token.length === 0) return spans;
  for (let from = text.indexOf(token); from !== -1; from = text.indexOf(token, from + 1)) {
    const end = from + token.length;
    if (!isWordChar(text[from - 1]) && !isWordChar(text[end])) spans.push({ start: from, end });
  }
  return spans;
}
