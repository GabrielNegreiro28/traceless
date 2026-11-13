import { describe, expect, it } from 'vitest';
import { parseDataset, type Dataset } from '../../domain/evaluation/datasetSchema';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import type { EvalScan } from './evaluateDetection';
import { runEval as run } from './evaluateDetection.testKit';
import { scanReport } from './scanReport';

// Read as raw text at build time: the project has no Node type definitions for `fs`.
const files = import.meta.glob<string>('../../../eval/datasets/reports.v1.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function realDataset(): Dataset {
  const text = Object.values(files)[0];
  if (text === undefined) throw new Error('eval/datasets/reports.v1.json not found');
  const parsed = parseDataset(JSON.parse(text));
  if (!parsed.ok) throw new Error('dataset does not parse');
  return parsed.value;
}

/** Rules only: the model never finds anything. */
function rulesOnly(): EvalScan {
  const scanner = new FakeIdentityScanner();
  return (text) => scanReport(text, { scanner, clock: new FakeClock(0, 5), chunkChars: 3000 });
}

describe('evaluateDetection rules-only baseline', () => {
  it('is deterministic with a scanner that finds nothing', async () => {
    const first = await run(rulesOnly(), 'all');
    const second = await run(rulesOnly(), 'all');
    expect(second).toEqual(first);
    const metrics = first.runs[0]?.metrics;
    expect(metrics?.combinedRecall).toBe(2 / 4);
    expect(metrics?.modelOnlyRecall).toBe(0);
    expect(metrics?.['recall:DIRECT_IDENTIFIER']).toBe(1);
    expect(metrics?.['recall:ROLE_UNIQUE']).toBe(0);
    expect(metrics?.['violation:ACCUSED']).toBe(0);
    expect(metrics?.hallucinatedQuoteRate).toBeNull();
  });

  it('never flags a must-not span of the real dataset with a rule (all splits)', async () => {
    const result = await run(rulesOnly(), 'all', 1, undefined, realDataset());
    const ruleViolations = Object.entries(result.summary.pooled).filter(([key]) =>
      /^violation:[A-Z_]+:RULE$/.test(key),
    );
    expect(ruleViolations.length).toBeGreaterThan(0);
    // Prints only metric names and rates on failure, never report text.
    expect(Object.fromEntries(ruleViolations.filter(([, rate]) => (rate ?? 0) > 0))).toEqual({});
  });

  it('catches the dev sign-off with the sign-off rule', async () => {
    const result = await run(rulesOnly(), 'dev', 1, undefined, realDataset());
    expect(result.summary.pooled['recall:DIRECT_IDENTIFIER']).toBe(1);
  });
});
