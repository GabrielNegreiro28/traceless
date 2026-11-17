import { describe, expect, it } from 'vitest';
import { loadEvalDataset } from '../../test/evalDataset';
import { countSharedShingles, shingleIndex, shingleWords } from '../../test/shingles';
import { VERIFY_FEW_SHOTS } from './disclosureVerify.v1.fewShots';
import { FEW_SHOT_V3_INVESTIGATOR } from './identityScan.v3-investigator.fewShots';

/**
 * Test-set integrity for the Layer-3 prompts (DECISIONS 2026-11-17): every few-shot is
 * invented, never drawn from the v1 evaluation dataset (the dev pool). The held-out v2 test
 * split is never read here (information barrier). Failures report counts and invented names
 * only, never dataset text.
 */
const REPORTS = [
  ...FEW_SHOT_V3_INVESTIGATOR.map((e) => e.report),
  ...VERIFY_FEW_SHOTS.map((e) => e.report),
];

/** Invented person names of the Layer-3 few-shots, lower-cased. */
const INVENTED_NAMES = [
  'teodora',
  'quillfeather',
  'pell',
  'gustavo',
  'renfrew',
  'ottoline',
  'prewett',
];

describe('Layer-3 few-shots are disjoint from the evaluation dataset', () => {
  const dataset = loadEvalDataset().reports.map((r) => r.text);
  const datasetShingles = shingleIndex(dataset);

  it('has a dataset to compare with', () => {
    expect(dataset.length).toBe(24);
  });

  it.each(REPORTS.map((report, i) => [i, report] as const))(
    'example %i shares no 6-word sequence with any dataset report',
    (_, report) => {
      expect(countSharedShingles(report, datasetShingles)).toBe(0);
    },
  );

  it('uses no person name that appears in any dataset report', () => {
    const datasetWords = new Set(dataset.flatMap(shingleWords));
    const fewShotWords = new Set(REPORTS.flatMap(shingleWords));
    expect(INVENTED_NAMES.filter((name) => !fewShotWords.has(name))).toEqual([]);
    expect(INVENTED_NAMES.filter((name) => datasetWords.has(name))).toEqual([]);
  });

  it('verifier few-shot candidates are exact slices of their reports', () => {
    for (const example of VERIFY_FEW_SHOTS) {
      for (const candidate of example.candidates) expect(example.report).toContain(candidate);
      expect(example.items.map((i) => i.id)).toEqual(example.candidates.map((_, i) => i + 1));
    }
  });
});
