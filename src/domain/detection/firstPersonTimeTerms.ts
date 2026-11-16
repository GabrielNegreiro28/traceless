import { alt, SP, wordList } from './firstPersonLexicons';

/**
 * Closed roster vocabulary of the SCHEDULE family (docs/design/fase2-gate-iteration.md §G.3):
 * weekdays, shift terms, clock times and work verbs from general UK/US workplace English.
 * Deletions and tightening only after the dev measurement.
 */

const WEEKDAY_STEM = String.raw`(?:mon|tues|wednes|thurs|fri|satur|sun)`;

/** Monday to Sunday, singular ("on Monday") or plural ("Mondays", a regular rota day). */
export const WEEKDAY = String.raw`${WEEKDAY_STEM}days?`;

/** Named shifts of common rosters: "night shift", "early-shift", "late shifts". */
const SHIFT_NAME = alt(
  wordList(`
    night day early late morning evening afternoon graveyard weekend overnight split swing
    twilight double relief on-call
  `),
);

/** Rota words in the plural ("I work nights", "I do lates"): the regular-pattern sense. */
const ROTA_WORD = alt(
  wordList(`
    nights days lates earlies overnights doubles weekends mornings afternoons evenings
  `),
);

/** Clock times: "6am", "6:30 pm", "6 a.m.", "22:00", "7 o'clock", midnight, noon. */
const CLOCK_TIME = String.raw`(?:\d{1,2}(?::[0-5]\d)?[ \t]?(?:am|pm|a\.m\.|p\.m\.)|(?:[01]?\d|2[0-3]):[0-5]\d|\d{1,2}[ \t]o['’]clock|midnight|midday|noon)`;

/** A shift, rota word, weekday or clock time: the term that makes a sentence a schedule. */
export const TIME_TERM = `(?:${SHIFT_NAME}[ \\t-]shifts?|${WEEKDAY}|${ROTA_WORD}|${CLOCK_TIME})`;

/**
 * A regular-pattern time term only: plural weekdays, rota words, plural named shifts ("I
 * worked Mondays", "we covered night shifts"). Past tense needs one, because "I finished at
 * 10pm that night" or "I was working on Monday" is the incident, not the writer's roster.
 */
export const REGULAR_TIME_TERM = `(?:${SHIFT_NAME}[ \\t-]shifts|${WEEKDAY_STEM}days|${ROTA_WORD})`;

/** After a time term: no possessive ("Monday's agenda"), no "days off", no "two days ago". */
export const TIME_END = `(?![A-Za-z0-9'’-])(?!${SP}(?:off|ago)\\b)`;

/** The frozen work verbs (work, cover, start, finish) in their present and -ing forms. */
export const PRESENT_WORK_VERB = alt(
  wordList(`
    work works working cover covers covering start starts starting finish finishes finishing
  `),
);

/** The same verbs in the past tense; they fire only with a REGULAR_TIME_TERM. */
export const PAST_WORK_VERB = alt(wordList('worked covered started finished'));

/**
 * Words allowed between a work verb and its time term ("start my shift at 6am", "work
 * every other Sunday"). Vague quantifiers (most, some, all) are left out on purpose.
 */
export const SCHEDULE_FILLER = alt(
  wordList(`
    the a an every other alternate on at from until till through during around about in over
    by my our shift shifts work
  `),
);

/** Being put on a rota: "I'm rostered on Sundays", "we are scheduled for the weekend". */
export const ROSTER_WORD = alt(wordList('rostered scheduled booked'));

/** Words allowed between "on" (or a roster word) and the time term. */
export const ON_FILLER = alt(wordList('the a an every other alternate'));

/** What joins two time terms into one range: "to", "through", "until", "and" or a dash. */
const RANGE_LINK = String.raw`(?:[ \t]*[-–—][ \t]*|${SP}(?:to|through|thru|until|till|and)${SP})`;

/**
 * A time term, or a range of them ("Tuesday to Saturday", "Monday–Friday", "10pm until
 * 6am"), optionally followed by a second one after a comma or "from" ("Tuesday to Saturday,
 * from 10 p.m. to 6 a.m.", "nights, from 9pm to 5am"), so one schedule is one finding.
 */
export function timeRange(term: string): string {
  const range = `${term}(?:${RANGE_LINK}${term})?`;
  return `${range}(?:,?${SP}(?:from${SP})?${range})?`;
}
