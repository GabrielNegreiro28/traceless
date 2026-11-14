import {
  endsEmploymentEvent,
  hasNonPartyHead,
  hasRoleHead,
  isTenureGap,
  type PatternMatch,
} from './firstPersonChecks';
import {
  EMPLOYMENT_EVENT,
  LEAVE_TYPE,
  NUMBER_WORD,
  RETURN_EVENT,
  SMALL_NUMBER_DIGITS,
  SP,
  TENURE_UNIT,
  WORD_END,
  alt,
  wordList,
} from './firstPersonLexicons';
import { MY_OR_OUR, SPECIFIED_PLACE } from './firstPersonPlaces';
import {
  ON_FILLER,
  PAST_WORK_VERB,
  PRESENT_WORK_VERB,
  REGULAR_TIME_TERM,
  ROSTER_WORD,
  SCHEDULE_FILLER,
  TIME_END,
  TIME_TERM,
} from './firstPersonTimeTerms';
import { ADVERB, NOUN_PHRASE_WORD as NP } from './firstPersonWords';
import type { FindingCategory } from './types';

/**
 * The six frozen families of the first-person rule pack (docs/design/fase2-gate-iteration.md
 * §G.3). Each pattern holds its first-person anchor (I, I'm, I've, we, my, our) before or inside
 * the named group `span`, which becomes the finding: 2–8 whole words, never across a sentence.
 * The span leaves the anchor out where a generic suggestion must replace it cleanly ("I'm [the
 * only night porter]" → "I'm a member of the team").
 */

export const FIRST_PERSON_FAMILY_IDS = [
  'onlyOne',
  'oneOfN',
  'tenure',
  'shift',
  'employmentEvent',
  'namedSite',
] as const;

export type FirstPersonFamilyId = (typeof FIRST_PERSON_FAMILY_IDS)[number];

export interface FamilyPattern {
  /** Regex source with a named group `span`; compiled with `flags` plus `d` (match indices). */
  readonly source: string;
  readonly flags: 'gi' | 'g';
  /** Generic replacement for the span when the reporter accepts it. */
  readonly suggestion: string;
  /** Extra check on a regex match; it can only reject. */
  readonly accept?: (match: PatternMatch) => boolean;
}

export interface FirstPersonFamily {
  readonly id: FirstPersonFamilyId;
  readonly category: FindingCategory;
  readonly reason: string;
  readonly patterns: readonly FamilyPattern[];
}

const I_AM = String.raw`\b(?:I${SP}am|I['’]m|im)`;
const I_HAVE = String.raw`\b(?:I['’]ve|I${SP}have|ive)`;
const MAYBE_ADVERB = `(?:${SP}${ADVERB})?`;
const PLURAL_NOUN = String.raw`(?:people|staff|women|men|personnel|crew|[A-Za-z][A-Za-z-]{1,30}(?<![sui])s)`;
const QUANTIFIER = alt(
  wordList('just_over just_under well_over more_than close_to over almost nearly about around'),
);
const GAP_WORD = String.raw`[A-Za-z][A-Za-z'’-]{0,30}`;
/** "I work", "we've been working", "I usually start": a present first-person subject. */
const PRESENT_WORK_SUBJECT = String.raw`\b(?:I|we)(?:['’](?:ve|ll|m|re))?(?:${SP}${alt([...wordList('have will been am are be'), ADVERB])}){0,2}`;
/** Any first-person subject, past auxiliaries included ("I had", "we were", "I'd"). */
const ANY_WORK_SUBJECT = String.raw`\b(?:I|we)(?:['’](?:ve|d|ll|m|re))?(?:${SP}${alt([...wordList('have had will would been am are was were be'), ADVERB])}){0,2}`;
const BE_PRESENT_SUBJECT = String.raw`\b(?:I['’]m|im|I${SP}am|we['’]re|we${SP}are)`;
const BE_PAST_SUBJECT = String.raw`\b(?:I${SP}was|we${SP}were)`;
/** "rostered on", "scheduled for the", "on every other": what leads to a roster time term. */
const ROSTER_LEAD = String.raw`(?:${ROSTER_WORD}(?:${SP}(?:on|for))?|on)(?:${SP}${ON_FILLER}){0,2}`;
const WHEN_I = String.raw`(?:when|after|since)${SP}I${SP}`;

const onlyOne: FirstPersonFamily = {
  id: 'onlyOne',
  category: 'ROLE_UNIQUE',
  reason: 'Being the only person in a role points straight at you.',
  patterns: [
    {
      source: `${I_AM}${MAYBE_ADVERB}${SP}(?<span>the${SP}only${SP}(?<np>${NP}(?:${SP}(?:of${SP})?${NP}){0,3}))${WORD_END}`,
      flags: 'gi',
      suggestion: 'a member of the team',
      accept: hasRoleHead,
    },
  ],
};

const oneOfN: FirstPersonFamily = {
  id: 'oneOfN',
  category: 'TEAM_SIZE',
  reason: 'Saying how few of you there are narrows down who you could be.',
  patterns: [
    {
      source: `${I_AM}${MAYBE_ADVERB}${SP}(?<span>one${SP}of${SP}(?:the${SP})?(?:only${SP}|just${SP})?(?:${NUMBER_WORD}|${SMALL_NUMBER_DIGITS})(?:${SP}${NP}){0,2}?${SP}${PLURAL_NOUN})${WORD_END}`,
      flags: 'gi',
      suggestion: 'one of the staff',
      accept: hasNonPartyHead,
    },
  ],
};

const tenure: FirstPersonFamily = {
  id: 'tenure',
  category: 'PERSONAL_TRAIT',
  reason: 'How long you have worked there can be matched against staff records.',
  patterns: [
    {
      source: `${I_HAVE}${MAYBE_ADVERB}${SP}(?<verb>worked|been)(?<gap>(?:${SP}${GAP_WORD}){0,5}?)${SP}(?<span>for${SP}(?:${QUANTIFIER}${SP})?(?:${NUMBER_WORD}|\\d{1,2}|an?)(?:${SP}and${SP}a${SP}half)?${SP}${TENURE_UNIT})${WORD_END}`,
      flags: 'gi',
      suggestion: 'for some time',
      accept: isTenureGap,
    },
  ],
};

const shift: FirstPersonFamily = {
  id: 'shift',
  category: 'SCHEDULE',
  reason: 'Your shifts or hours narrow down who was at work.',
  patterns: [
    {
      source: `${PRESENT_WORK_SUBJECT}${SP}(?<span>${PRESENT_WORK_VERB}(?:${SP}${SCHEDULE_FILLER}){0,3}?${SP}${TIME_TERM})${TIME_END}`,
      flags: 'gi',
      suggestion: 'work some shifts',
    },
    {
      source: `${ANY_WORK_SUBJECT}${SP}(?<span>${PAST_WORK_VERB}(?:${SP}${SCHEDULE_FILLER}){0,3}?${SP}${REGULAR_TIME_TERM})${TIME_END}`,
      flags: 'gi',
      suggestion: 'worked some shifts',
    },
    {
      source: `${BE_PRESENT_SUBJECT}${MAYBE_ADVERB}${SP}(?<span>${ROSTER_LEAD}${SP}${TIME_TERM})${TIME_END}`,
      flags: 'gi',
      suggestion: 'on some shifts',
    },
    {
      source: `${BE_PAST_SUBJECT}${MAYBE_ADVERB}${SP}(?<span>${ROSTER_LEAD}${SP}${REGULAR_TIME_TERM})${TIME_END}`,
      flags: 'gi',
      suggestion: 'on some shifts',
    },
  ],
};

const employmentEvent: FirstPersonFamily = {
  id: 'employmentEvent',
  category: 'PERSONAL_EVENT_DATE',
  reason: 'When you joined, came back or changed roles can be matched against HR records.',
  patterns: [
    {
      source: String.raw`\b(?<span>${WHEN_I}(?:first${SP})?(?<event>${EMPLOYMENT_EVENT})(?:${SP}(?:here|there))?)${WORD_END}`,
      flags: 'gi',
      suggestion: 'recently',
      accept: endsEmploymentEvent,
    },
    {
      source: String.raw`\b(?<span>${WHEN_I}${RETURN_EVENT}${SP}(?:(?:from|off)${SP}(?:my${SP}|the${SP})?${LEAVE_TYPE}|to${SP}work))${WORD_END}`,
      flags: 'gi',
      suggestion: 'recently',
    },
  ],
};

const namedSite: FirstPersonFamily = {
  id: 'namedSite',
  category: 'LOCATION',
  reason: 'Naming your exact site narrows down where you work.',
  patterns: [
    {
      source: `${MY_OR_OUR}${SP}(?<span>${SPECIFIED_PLACE})${WORD_END}`,
      flags: 'g',
      suggestion: 'workplace',
    },
  ],
};

export const FIRST_PERSON_FAMILIES: Readonly<Record<FirstPersonFamilyId, FirstPersonFamily>> = {
  onlyOne,
  oneOfN,
  tenure,
  shift,
  employmentEvent,
  namedSite,
};
