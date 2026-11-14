import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import { loadEvalDataset } from '../../test/evalDataset';
import type { EvalScan } from './evaluateDetection';
import { runEval as run } from './evaluateDetection.testKit';
import { scanReport } from './scanReport';

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

  // Dev split only (docs/design/fase2-gate-iteration.md §G.3): a deterministic assertion over
  // the test split would leak test-split feedback into rule design.
  it('never flags a must-not span of the real dataset with a rule (dev split only)', async () => {
    const result = await run(rulesOnly(), 'dev', 1, undefined, loadEvalDataset());
    expect(result.split).toBe('dev');
    const ruleViolations = Object.entries(result.summary.pooled).filter(([key]) =>
      /^violation:[A-Z_]+:RULE$/.test(key),
    );
    expect(ruleViolations.length).toBeGreaterThan(0);
    // Prints only metric names and rates on failure, never report text.
    expect(Object.fromEntries(ruleViolations.filter(([, rate]) => (rate ?? 0) > 0))).toEqual({});
  });

  it('catches the dev sign-off with the sign-off rule', async () => {
    const result = await run(rulesOnly(), 'dev', 1, undefined, loadEvalDataset());
    expect(result.summary.pooled['recall:DIRECT_IDENTIFIER']).toBe(1);
  });
});
