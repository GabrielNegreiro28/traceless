import { describe, expect, it } from 'vitest';
import { extractNameTokens } from '../../domain/detection/nameTokens';
import { FEW_SHOT_V2 } from './identityScan.v2.fewShots';

/**
 * Test-set integrity: the few-shots must be invented, never drawn from the evaluation
 * dataset (any split). Failures report counts and invented names only, never dataset text.
 */
const files = import.meta.glob<string>('../../../eval/datasets/reports.v1.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function datasetTexts(): string[] {
  const raw = Object.values(files)[0];
  if (raw === undefined) throw new Error('eval/datasets/reports.v1.json not found');
  const parsed = JSON.parse(raw) as { reports: { text: string }[] };
  return parsed.reports.map((r) => r.text);
}

const SHINGLE_WORDS = 6;

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];
}

function shingles(text: string): Set<string> {
  const list = words(text);
  const result = new Set<string>();
  for (let i = 0; i + SHINGLE_WORDS <= list.length; i++) {
    result.add(list.slice(i, i + SHINGLE_WORDS).join(' '));
  }
  return result;
}

/** Invented person names used by the few-shots (outlets and the sign-off), lower-cased. */
function fewShotNames(): string[] {
  const people = FEW_SHOT_V2.flatMap((e) =>
    e.items.filter((i) => i.category !== 'ROLE_UNIQUE' && i.category !== 'SCHEDULE'),
  );
  const tokens = people.flatMap((item) => extractNameTokens(item.quote));
  const parts = tokens.flatMap((t) => t.toLowerCase().split('-'));
  return [...new Set([...parts, 'bram'])];
}

describe('FEW_SHOT_V2 is disjoint from the evaluation dataset', () => {
  const dataset = datasetTexts();
  const datasetShingles = new Set(dataset.flatMap((text) => [...shingles(text)]));

  it('has a dataset to compare with', () => {
    expect(dataset.length).toBeGreaterThan(0);
    expect(datasetShingles.size).toBeGreaterThan(100);
  });

  it.each(FEW_SHOT_V2.map((e, i) => [i, e] as const))(
    'example %i shares no 6-word sequence with any dataset report',
    (_, example) => {
      const shared = [...shingles(example.report)].filter((s) => datasetShingles.has(s));
      expect(shared.length).toBe(0);
    },
  );

  it('uses no person name that appears in any dataset report', () => {
    const datasetWords = new Set(dataset.flatMap(words));
    const names = fewShotNames();
    expect(names.length).toBeGreaterThanOrEqual(8);
    expect(names.filter((name) => datasetWords.has(name))).toEqual([]);
  });
});
