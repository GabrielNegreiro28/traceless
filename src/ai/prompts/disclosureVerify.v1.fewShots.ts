import type { DisclosureSubject } from '../../domain/detection/candidates/verifiedFindings';
import type { ModelFindingCategory } from '../schemas/identityScan';

/** One judged candidate exactly as the model must emit it (1-based id). */
export interface VerifyFewShotItem {
  readonly id: number;
  readonly about: DisclosureSubject;
  readonly category: ModelFindingCategory | 'NONE';
}

export interface VerifyFewShotExample {
  readonly report: string;
  /** Exact phrases of `report`, numbered from 1 in the prompt. */
  readonly candidates: readonly string[];
  readonly items: readonly VerifyFewShotItem[];
}

/**
 * Two tiny invented examples (sectors, names and schemes of their own; tested disjoint from
 * the evaluation dataset): (i) a ferry ticket office, writer role/place/schedule judged
 * WRITER, the reported person's act judged OTHER; (ii) a bakery, a writer's personal date
 * and team size, plus a candidate that reveals nothing (NONE) and one about someone else.
 */
export const VERIFY_FEW_SHOTS: readonly VerifyFewShotExample[] = [
  {
    report:
      'I am the only clerk who opens the ferry ticket kiosk at dawn, so I see the cash drawer before anyone. The harbour master, Ottoline Prewett, takes notes from it every Friday.',
    candidates: [
      'the only clerk who opens the ferry ticket kiosk',
      'at dawn',
      'takes notes from it every Friday',
    ],
    items: [
      { id: 1, about: 'WRITER', category: 'ROLE_UNIQUE' },
      { id: 2, about: 'WRITER', category: 'SCHEDULE' },
      { id: 3, about: 'OTHER', category: 'NONE' },
    ],
  },
  {
    report:
      'Since my return from parental leave in April, our crew of four bakers has watched the owner relabel stale loaves. I think it is wrong.',
    candidates: [
      'my return from parental leave in April',
      'our crew of four bakers',
      'relabel stale loaves',
      'I think it is wrong',
    ],
    items: [
      { id: 1, about: 'WRITER', category: 'PERSONAL_EVENT_DATE' },
      { id: 2, about: 'WRITER', category: 'TEAM_SIZE' },
      { id: 3, about: 'OTHER', category: 'NONE' },
      { id: 4, about: 'WRITER', category: 'NONE' },
    ],
  },
];
