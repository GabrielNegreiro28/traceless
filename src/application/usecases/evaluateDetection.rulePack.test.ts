import { describe, expect, it } from 'vitest';
import type { RulePack } from '../../domain/detection/rulePacks';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import { evaluateDetection, type EvalScan, type VariantInfo } from './evaluateDetection';
import { scanReport } from './scanReport';

/** Invented report: the writer's unique role is gold; the accused's own shift must not flag. */
const DATASET: Dataset = {
  version: 'rule-pack-test',
  reports: [
    {
      id: 'g1',
      sector: 'crafts',
      split: 'dev',
      text: "I'm the only glassblower at the kiln yard. We work nights while the warden sleeps.",
      gold: [{ quote: 'the only glassblower', category: 'ROLE_UNIQUE' }],
      mustNotFlag: [{ quote: 'work nights', kind: 'INCIDENT_FACT' }],
    },
  ],
};

function rulesOnly(rulePack: RulePack): EvalScan {
  const scanner = new FakeIdentityScanner();
  return (text) =>
    scanReport(text, { scanner, clock: new FakeClock(0, 5), chunkChars: 3000, rulePack });
}

async function evaluate(scanPack: RulePack, variantPack: RulePack | undefined) {
  const variant: VariantInfo = {
    id: 'rules-only',
    promptVersion: 'none',
    strategy: 'none',
    chunkChars: 3000,
    postFilters: [],
    ...(variantPack === undefined ? {} : { rulePack: variantPack }),
  };
  const result = await evaluateDetection({
    dataset: DATASET,
    split: 'dev',
    scan: rulesOnly(scanPack),
    clock: { now: () => 0 },
    runs: 1,
    variant,
  });
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}

describe('evaluateDetection: RULE attribution follows the rule pack (§G.3)', () => {
  it('attributes first-person findings to RULE with the core+firstPerson pack', async () => {
    const result = await evaluate('core+firstPerson', 'core+firstPerson');
    expect(result.variant.rulePack).toBe('core+firstPerson');
    expect(result.summary.pooled).toMatchObject({
      strictRecall: 1,
      modelOnlyRecall: null,
      'violation:INCIDENT_FACT': 1,
      'violation:INCIDENT_FACT:RULE': 1,
      'violation:INCIDENT_FACT:MODEL': 0,
    });
  });

  it('reads a variant without a rule pack (old result files) as core', async () => {
    const result = await evaluate('core', undefined);
    expect(result.variant.rulePack).toBeUndefined();
    expect(result.summary.pooled).toMatchObject({
      strictRecall: 0,
      modelOnlyRecall: 0,
      'violation:INCIDENT_FACT:RULE': 0,
    });
  });
});
