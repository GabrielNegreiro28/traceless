import { describe, expect, it } from 'vitest';
import { loadEvalDatasetV2, loadEvalDatasetV2Json } from '../../test/evalDatasetV2';
import { parseDataset } from './datasetSchema';
import { resolveReport, validateDataset, type ResolvedGold } from './resolveSpans';

// Assertions use counts, ids and annotation paths only: never report text or quotes.

function goldOverlapPaths(reportId: string, gold: readonly ResolvedGold[]): string[] {
  const paths: string[] = [];
  gold.forEach((a, i) => {
    gold.slice(i + 1).forEach((b, offset) => {
      if (a.span.start < b.span.end && b.span.start < a.span.end) {
        paths.push(`${reportId}:gold[${i}]~gold[${i + 1 + offset}]`);
      }
    });
  });
  return paths;
}

describe('eval/datasets/reports.v2.test.json', () => {
  it('matches the dataset schema', () => {
    expect(parseDataset(loadEvalDatasetV2Json()).ok).toBe(true);
  });

  it('resolves every quote and has no gold overlapping a must-not span', () => {
    expect(validateDataset(loadEvalDatasetV2())).toEqual([]);
  });

  it('has no gold span overlapping another gold span', () => {
    const overlaps = loadEvalDatasetV2().reports.flatMap((report) => {
      const resolved = resolveReport(report);
      return resolved.ok
        ? goldOverlapPaths(report.id, resolved.value.gold)
        : [`${report.id}:unresolved`];
    });
    expect(overlaps).toEqual([]);
  });

  it('is a held-out test split of at least 20 reports and 72 gold quotes', () => {
    const { version, reports } = loadEvalDatasetV2();
    const goldCount = reports.reduce((sum, report) => sum + report.gold.length, 0);
    expect(version).toBe('reports.v2-test');
    expect(reports.length).toBeGreaterThanOrEqual(20);
    expect(goldCount).toBeGreaterThanOrEqual(72);
    expect(reports.filter((report) => report.split !== 'test').map((r) => r.id)).toEqual([]);
  });
});
