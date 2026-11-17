import type { FewShotExampleV2 } from './identityScan.v2.fewShots';

const REPORTED = 'The person being reported.';

/**
 * Two invented examples for the investigator prompt (sectors, names and schemes of their
 * own; tested disjoint from the evaluation dataset). (i) a hotel laundry: the writer's
 * unique role, start date, hours and workplace are clues, the reported person's
 * "[title], [Name]" introduction is an outlet, a count is left unquoted, and the sign-off
 * is the writer's name; (ii) a lowercase note from a ferry dispatch team: team size and a
 * language trait are clues, the reported shift lead is an outlet.
 */
export const FEW_SHOT_V3_INVESTIGATOR: readonly FewShotExampleV2[] = [
  {
    report:
      "Hello, I joined the hotel laundry in January as the only night presser, so I am alone in the basement from 11pm to 7am. Our housekeeping director, Ms. Teodora Quillfeather, sells guests' forgotten belongings online; I counted 23 listings last month.\n\nPell",
    items: [
      {
        quote: 'joined the hotel laundry in January',
        category: 'PERSONAL_EVENT_DATE',
        reason: 'A start date narrows down who wrote this.',
        suggestion: 'joined the hotel laundry',
      },
      {
        quote: 'the only night presser',
        category: 'ROLE_UNIQUE',
        reason: 'Only one person has this job.',
        suggestion: 'a laundry worker',
      },
      {
        quote: 'in the basement',
        category: 'LOCATION',
        reason: 'Where the writer works points to them.',
        suggestion: '',
      },
      {
        quote: 'from 11pm to 7am',
        category: 'SCHEDULE',
        reason: 'The writer works these hours alone.',
        suggestion: 'on some shifts',
      },
      {
        quote: 'Our housekeeping director, Ms. Teodora Quillfeather',
        category: 'REPORTED_PERSON',
        reason: REPORTED,
        suggestion: '',
      },
      {
        quote: 'Pell',
        category: 'DIRECT_IDENTIFIER',
        reason: "The writer's own name in the sign-off.",
        suggestion: '',
      },
    ],
  },
  {
    report:
      'we are a team of three dispatchers at the ferry terminal and our shift lead, gustavo renfrew, logs fake overtime for his cousin. i am the one who talks to the crews in portuguese.',
    items: [
      {
        quote: 'a team of three dispatchers',
        category: 'TEAM_SIZE',
        reason: 'A team this small narrows the writer down.',
        suggestion: 'a team of dispatchers',
      },
      {
        quote: 'our shift lead, gustavo renfrew',
        category: 'REPORTED_PERSON',
        reason: REPORTED,
        suggestion: '',
      },
      {
        quote: 'talks to the crews in portuguese',
        category: 'PERSONAL_TRAIT',
        reason: 'The language the writer speaks points to them.',
        suggestion: 'talks to the crews',
      },
    ],
  },
];
