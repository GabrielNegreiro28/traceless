import { describe, expect, it } from 'vitest';
import { loadEvalDataset } from '../../test/evalDataset';
import { countSharedShingles, shingleIndex } from '../../test/shingles';
import { FIRST_PERSON_FAMILY_IDS } from './firstPersonFamilies';
import {
  BOUNDARY_NEGATIVES,
  HARD_NEGATIVES,
  MARKED_POSITIVES,
  parsePositive,
} from './firstPersonRules.testKit';

/**
 * Test-set integrity (docs/design/fase2-gate-iteration.md §G.3): the first-person unit corpus
 * is invented and shares no 6-word sequence with any evaluation report (any split). Failures
 * report counts only, never dataset text.
 */
const CORPUS: readonly string[] = [
  ...FIRST_PERSON_FAMILY_IDS.flatMap((id) =>
    MARKED_POSITIVES[id].map((m) => parsePositive(m).text),
  ),
  ...HARD_NEGATIVES,
  ...BOUNDARY_NEGATIVES,
];

describe('first-person unit corpus is disjoint from the evaluation dataset', () => {
  const datasetShingles = shingleIndex(loadEvalDataset().reports.map((r) => r.text));

  it('has a dataset to compare with', () => {
    expect(datasetShingles.size).toBeGreaterThan(100);
  });

  it('shares no 6-word sequence with any dataset report', () => {
    const shared = CORPUS.map((text) => countSharedShingles(text, datasetShingles));
    expect(shared.reduce((total, n) => total + n, 0)).toBe(0);
  });
});
