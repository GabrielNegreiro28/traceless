/**
 * Closed lexicons of the first-person rule pack (docs/design/fase2-gate-iteration.md §G.3):
 * the shared regex helpers plus numbers and employment events. Every list comes from general
 * English and everyday workplace vocabulary, never from evaluation reports. After the dev
 * measurement entries may only be deleted or tightened, never added because of a dev miss.
 *
 * Each export is a regex SOURCE fragment without capture groups or flags; the families
 * combine them and the matcher compiles fresh RegExps (no shared lastIndex state).
 */

/** Spaces or tabs between two words of one phrase (never a newline: no line crossing). */
export const SP = String.raw`[ \t]{1,3}`;

/** The end of a word: no letter, digit, apostrophe or hyphen follows. */
export const WORD_END = String.raw`(?![A-Za-z0-9'’-])`;

/**
 * A word list written as one space-separated string; `_` joins the words of a phrase
 * ("maternity_leave" matches "maternity leave").
 */
export function wordList(spec: string): string[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((entry) => entry.split('_').join(SP));
}

/** A non-capturing alternation of the entries, in order (put longer entries first). */
export function alt(entries: readonly string[]): string {
  return `(?:${entries.join('|')})`;
}

/**
 * Number words two to twelve: a group that small narrows down who the writer is; larger
 * groups rarely do. Digits use the same closed range.
 */
export const NUMBER_WORD = alt(
  wordList('two three four five six seven eight nine ten eleven twelve'),
);
export const SMALL_NUMBER_DIGITS = String.raw`(?<![\d.,])(?:1[0-2]|[2-9])(?![\d.,])`;

/** Tenure units; weeks and days are too short to be a staff-record trait. */
export const TENURE_UNIT = String.raw`(?:years?|months?|decades?)`;

/** Employment events that HR records with a date (joined, hired, promoted, transferred). */
export const EMPLOYMENT_EVENT = alt(
  wordList(`
    started joined was_hired got_hired was_taken_on was_promoted got_promoted
    was_transferred got_transferred transferred
  `),
);

/** Coming back to work; it needs a leave type or "to work" ("came back from lunch" is not one). */
export const RETURN_EVENT = alt(wordList('came_back got_back went_back returned'));

/** Leave types that HR systems record with dates (UK and US names), longest first. */
export const LEAVE_TYPE = alt(
  wordList(`
    shared_parental_leave maternity_leave paternity_leave parental_leave adoption_leave
    long-term_sick_leave long-term_sick sick_leave medical_leave sickness_absence
    compassionate_leave bereavement_leave annual_leave unpaid_leave study_leave career_break
    leave holidays holiday vacation sabbatical furlough secondment
  `),
);
