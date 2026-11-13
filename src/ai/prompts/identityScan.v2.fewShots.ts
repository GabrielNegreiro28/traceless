import type { IdentityScanLabel } from '../schemas/identityScan';

/** One item exactly as the model must emit it ("" suggestion = remove). */
export interface FewShotItemV2 {
  readonly quote: string;
  readonly category: IdentityScanLabel;
  readonly reason: string;
  readonly suggestion: string;
}

export interface FewShotExampleV2 {
  readonly report: string;
  readonly items: readonly FewShotItemV2[];
}

const REPORTED = 'The person being reported.';
const OTHER = 'Someone other than the writer.';

/**
 * Three invented examples (docs/design/fase2-gate-iteration.md §C.2), with sectors and
 * schemes of their own. They must stay disjoint from the evaluation dataset (tested: no
 * shared 6-word sequence, no shared names). (i) a theatre box-office cash skim: writer
 * detail mid-text, the accused's "[title], [Name]" introduction and a colleague as
 * outlets, a count and the timing of the wrongdoing left unflagged, the only sign-off;
 * (ii) falsified attendance at a language school, third person, only REPORTED_PERSON
 * items; (iii) a lowercase run-on about catering kickbacks with a common job left
 * unflagged and the writer's schedule in the last sentence.
 */
export const FEW_SHOT_V2: readonly FewShotExampleV2[] = [
  {
    report:
      'To the trust board: since the spring season opened, our front-of-house manager, Mr. Desmond Vellacourt, has been voiding cash ticket sales after matinees and keeping the money. The till reports show 140 voided cash sales in six weeks, nearly all for the same two shows. I am the only cashier on matinee days, so I close the till before he counts it. Ilona Varga in accounts saw the gap in the bank deposits as well.\n\nThanks,\nNoor Haddadin',
    items: [
      {
        quote: 'our front-of-house manager, Mr. Desmond Vellacourt',
        category: 'REPORTED_PERSON',
        reason: REPORTED,
        suggestion: '',
      },
      {
        quote: 'the only cashier on matinee days',
        category: 'ROLE_UNIQUE',
        reason: 'Only one person works the till on these days.',
        suggestion: 'a box office cashier',
      },
      { quote: 'Ilona Varga', category: 'OTHER_PERSON', reason: OTHER, suggestion: '' },
      {
        quote: 'Noor Haddadin',
        category: 'DIRECT_IDENTIFIER',
        reason: "The writer's own name in the sign-off.",
        suggestion: '',
      },
    ],
  },
  {
    report:
      'The director of studies, Priyanka Osterhagen, marks absent students as present so the language school keeps its visa sponsorship. The registers for the autumn term list 37 students at full attendance who never came to class, and Ms. Osterhagen approves every register herself.',
    items: [
      {
        quote: 'The director of studies, Priyanka Osterhagen',
        category: 'REPORTED_PERSON',
        reason: REPORTED,
        suggestion: '',
      },
      { quote: 'Ms. Osterhagen', category: 'REPORTED_PERSON', reason: REPORTED, suggestion: '' },
    ],
  },
  {
    report:
      'ok so the head of purchasing, bram, keeps choosing the same catering supplier even when their price is double the others and that supplier paid for his new car in may. im a cleaner like twenty others here so nobody asks us anything. i see every delivery because i work the early rotation, weekdays from 6:30',
    items: [
      {
        quote: 'the head of purchasing, bram',
        category: 'REPORTED_PERSON',
        reason: REPORTED,
        suggestion: '',
      },
      {
        quote: 'the early rotation, weekdays from 6:30',
        category: 'SCHEDULE',
        reason: 'When the writer works points to them.',
        suggestion: 'a regular rotation',
      },
    ],
  },
];
