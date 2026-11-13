import type { FindingCategory } from './types';

/**
 * Rule table for deterministic detection. Patterns are stored as source strings so
 * no shared stateful RegExp (lastIndex) leaks; the matcher builds a fresh RegExp.
 *
 * Every quantifier is bounded or acts on a single unambiguous character class, and
 * start-of-token lookbehinds prevent quadratic rescans on long runs (ReDoS-safe).
 */
export interface DetectionRule {
  readonly name: string;
  readonly pattern: string;
  readonly flags: string;
  readonly category: FindingCategory;
  readonly reason: string;
  readonly suggestion: string;
}

const MONTH = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)`;
const YEAR_SUFFIX = String.raw`(?:,?[ \t]{1,3}\d{4})?`;
const MONTH_NUM = String.raw`(?:0?[1-9]|1[0-2])`;
const DAY_NUM = String.raw`(?:0?[1-9]|[12]\d|3[01])`;
const MONTH_DAY = `${MONTH_NUM}/${DAY_NUM}`;
const DAY_MONTH = `${DAY_NUM}/${MONTH_NUM}`;
const MONTH_DAY_DOT = String.raw`${MONTH_NUM}\.${DAY_NUM}`;
const DAY_MONTH_DOT = String.raw`${DAY_NUM}\.${MONTH_NUM}`;
const NOT_DATE_NEIGHBOUR = String.raw`(?<![\d./-])`;
// A "ddd-dddd" next to a counting word is a range ("pages 120-1450", "300-4000 units"),
// not a phone. Simplest robust rule: skip it when such a word comes right before/after.
const COUNT_WORD_BEFORE = String.raw`\b(?:[Pp]ages?|pp|[Uu]nits?|[Ss]old|[Ii]tems?|[Rr]ooms?|[Ll]ines?|[Ss]teps?)[ \t]{1,3}`;
const COUNT_WORD_AFTER = String.raw`[ \t]{1,3}(?:units?|pages?|items?|people|staff|copies)\b`;
const ID_TAIL = String.raw`\d{3,}(?:-\d{1,12}){0,5}\b`;
const EMPLOYEE_LABEL = '(?:employee|badge|staff|personnel)';

const DATE = {
  reason: 'An exact date can be matched against records to find who was there.',
  suggestion: 'Use an approximate period, such as "earlier this year".',
};
const PHONE = {
  reason: 'A phone number identifies a specific person.',
  suggestion: 'Remove the phone number.',
};
const ID = {
  reason: 'A personal ID number points directly to one person.',
  suggestion: 'Remove the number.',
};

export const DETECTION_RULES: readonly DetectionRule[] = [
  {
    name: 'email',
    pattern: String.raw`(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}`,
    flags: 'g',
    category: 'DIRECT_IDENTIFIER',
    reason: 'An email address identifies a specific person.',
    suggestion: 'Remove the email address.',
  },
  {
    name: 'url',
    pattern: String.raw`\b(?:https?://|www\.)[^\s<>"']{0,2000}[^\s<>"'.,;:!?)\]]`,
    flags: 'g',
    category: 'DIRECT_IDENTIFIER',
    reason: 'A link can lead back to your profile, account or workplace.',
    suggestion: 'Remove the link or describe it in general terms.',
  },
  {
    name: 'phone-international',
    pattern: String.raw`(?<![\w@])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)`,
    flags: 'g',
    category: 'DIRECT_IDENTIFIER',
    ...PHONE,
  },
  {
    name: 'phone-us',
    pattern: String.raw`(?<![\w$.,]|\+\d{1,3}[\s.-])(?:\(\d{3}\)[\s.-]?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?!\d)`,
    flags: 'g',
    category: 'DIRECT_IDENTIFIER',
    ...PHONE,
  },
  {
    name: 'phone-ten-digits',
    pattern: String.raw`(?<![\w$.,+-])\d{10}(?![\d-])`,
    flags: 'g',
    category: 'DIRECT_IDENTIFIER',
    ...PHONE,
  },
  {
    name: 'phone-local-seven',
    pattern: String.raw`(?<![\w$.,+-]|\d{3}\)?[\s.-]?|${COUNT_WORD_BEFORE})\d{3}-\d{4}(?![\d-]|${COUNT_WORD_AFTER})`,
    flags: 'g',
    category: 'DIRECT_IDENTIFIER',
    ...PHONE,
  },
  {
    name: 'phone-eu',
    pattern: String.raw`(?<![\w$.,+])0\d{2,4}[\s/.-]\d{3,4}[\s.-]?\d{3,5}(?!\d)`,
    flags: 'g',
    category: 'DIRECT_IDENTIFIER',
    ...PHONE,
  },
  {
    name: 'employee-id',
    pattern: String.raw`\b${EMPLOYEE_LABEL}(?:(?:[ \t]{1,3}(?:id|number|no\.?)[ \t]{0,3}[:#]?|[ \t]{0,3}[:#])[ \t]{0,3}(?:[A-Z]{0,3}-?)|[ \t]{1,3}[A-Z]{1,3}-?)${ID_TAIL}`,
    flags: 'gi',
    category: 'DIRECT_IDENTIFIER',
    ...ID,
  },
  {
    name: 'labelled-id',
    pattern: String.raw`\bID[ \t]{0,3}[:#][ \t]{0,3}[A-Z]{0,4}-?${ID_TAIL}`,
    flags: 'g',
    category: 'DIRECT_IDENTIFIER',
    ...ID,
  },
  {
    name: 'date-month-first',
    pattern: String.raw`\b${MONTH}\.?[ \t]{1,3}\d{1,2}(?:st|nd|rd|th)?${YEAR_SUFFIX}\b`,
    flags: 'g',
    category: 'PERSONAL_EVENT_DATE',
    ...DATE,
  },
  {
    name: 'date-day-first',
    pattern: String.raw`\b\d{1,2}(?:st|nd|rd|th)?[ \t]{1,3}(?:of[ \t]{1,3})?${MONTH}${YEAR_SUFFIX}\b`,
    flags: 'g',
    category: 'PERSONAL_EVENT_DATE',
    ...DATE,
  },
  {
    name: 'date-numeric-slash',
    pattern: String.raw`${NOT_DATE_NEIGHBOUR}(?:${MONTH_DAY}|${DAY_MONTH})/(?:\d{4}|\d{2})(?![\d./])`,
    flags: 'g',
    category: 'PERSONAL_EVENT_DATE',
    ...DATE,
  },
  {
    // Dotted dates need a 4-digit year so versions like "2.10.15" are not dates.
    name: 'date-numeric-dot',
    pattern: String.raw`${NOT_DATE_NEIGHBOUR}(?:${MONTH_DAY_DOT}|${DAY_MONTH_DOT})\.\d{4}(?![\d.])`,
    flags: 'g',
    category: 'PERSONAL_EVENT_DATE',
    ...DATE,
  },
  {
    // Short "12/03" is only trusted after a date-introducing word (avoids "9/10").
    name: 'date-short',
    pattern: String.raw`(?<=\b(?:[Oo]n|[Ss]ince|[Bb]efore|[Aa]fter|[Uu]ntil|[Ff]rom)[ \t]{1,3})(?:${MONTH_DAY}|${DAY_MONTH})(?![\d./]|[ \t]{1,3}(?:of|people|staff|units)\b)`,
    flags: 'g',
    category: 'PERSONAL_EVENT_DATE',
    ...DATE,
  },
  {
    name: 'date-iso',
    pattern: String.raw`(?<![\d.-])\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?![\d-])`,
    flags: 'g',
    category: 'PERSONAL_EVENT_DATE',
    ...DATE,
  },
];
