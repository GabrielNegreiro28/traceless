import { describe, expect, it } from 'vitest';
import {
  FIRST_PERSON_FAMILY_IDS,
  type FirstPersonFamilyId,
} from '../../domain/detection/firstPersonFamilies';
import {
  detectFirstPersonMatches,
  FIRST_PERSON_PACK,
} from '../../domain/detection/firstPersonRules';
import type { RulePack } from '../../domain/detection/rulePacks';
import { findingTallies } from '../../domain/evaluation/goldCounts';
import { spansMatch } from '../../domain/evaluation/matching';
import { resolveReport, type ResolvedReport } from '../../domain/evaluation/resolveSpans';
import type { MetricSet } from '../../domain/evaluation/summary';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import { createLogger } from '../../shared/logger';
import { loadEvalDataset } from '../../test/evalDataset';
import { evaluateDetection } from './evaluateDetection';
import { scanReport } from './scanReport';

/**
 * Precision guard of the first-person rule pack (docs/design/fase2-gate-iteration.md §G.3),
 * deterministic and on the DEV split only: no RULE finding may hit a must-not span, and every
 * enabled family that fires 3+ times keeps precision >= 0.75 (a finding fits a gold span of
 * any category without being oversized, as in softPrecision). A failing family is dropped
 * whole from FIRST_PERSON_PACK, never patched. Output: counts and rates only, never text.
 */
const MIN_FIRES = 3;
const MIN_PRECISION = 0.75;
const MUST_NOT_KINDS = ['ACCUSED', 'INCIDENT_FACT', 'OTHER_PERSON'] as const;

interface FamilyStats {
  fires: number;
  correct: number;
  mustNotHits: number;
}

function devReports(): ResolvedReport[] {
  return loadEvalDataset()
    .reports.filter((r) => r.split === 'dev')
    .map((r) => {
      const resolved = resolveReport(r);
      if (!resolved.ok) throw new Error('dev annotations do not resolve');
      return resolved.value;
    });
}

/** Every family is measured (enabled or not); only enabled families are asserted. */
function familyStats(reports: readonly ResolvedReport[]): Record<FirstPersonFamilyId, FamilyStats> {
  const stats = Object.fromEntries(
    FIRST_PERSON_FAMILY_IDS.map((id) => [id, { fires: 0, correct: 0, mustNotHits: 0 }]),
  ) as Record<FirstPersonFamilyId, FamilyStats>;
  for (const report of reports) {
    for (const { family, finding } of detectFirstPersonMatches(
      report.text,
      FIRST_PERSON_FAMILY_IDS,
    )) {
      stats[family].fires += 1;
      stats[family].correct += findingTallies([finding], report.gold).findingsCorrect;
      if (report.mustNot.some((m) => spansMatch(finding.span, m.span)))
        stats[family].mustNotHits += 1;
    }
  }
  return stats;
}

const precision = (s: FamilyStats): number | null => (s.fires === 0 ? null : s.correct / s.fires);

async function rulesOnlyDev(rulePack: RulePack): Promise<MetricSet> {
  const scanner = new FakeIdentityScanner();
  const result = await evaluateDetection({
    dataset: loadEvalDataset(),
    split: 'dev',
    scan: (text) =>
      scanReport(text, { scanner, clock: new FakeClock(0, 5), chunkChars: 3000, rulePack }),
    clock: { now: () => 0 },
    runs: 1,
    variant: {
      id: 'rules-only',
      promptVersion: 'none',
      strategy: 'none',
      chunkChars: 3000,
      postFilters: [],
      rulePack,
    },
  });
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.summary.pooled;
}

describe('first-person rule pack: dev precision guard (§G.3)', () => {
  const reports = devReports();

  it('runs on the dev split only', () => {
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every((r) => r.split === 'dev')).toBe(true);
  });

  it('flags no ACCUSED, INCIDENT_FACT or OTHER_PERSON span with a rule', async () => {
    const pooled = await rulesOnlyDev('core+firstPerson');
    const ruleHits = Object.fromEntries(
      MUST_NOT_KINDS.map((kind) => [kind, pooled[`violation:${kind}:RULE`] ?? 0]),
    );
    expect(ruleHits).toEqual({ ACCUSED: 0, INCIDENT_FACT: 0, OTHER_PERSON: 0 });
  });

  it('keeps every enabled family that fires 3+ times at precision >= 0.75', () => {
    const stats = familyStats(reports);
    const failing = FIRST_PERSON_PACK.filter(
      (id) => stats[id].fires >= MIN_FIRES && (precision(stats[id]) ?? 1) < MIN_PRECISION,
    );
    expect(failing).toEqual([]);
  });

  it('prints the aggregate dev numbers (counts and rates only)', async () => {
    const stats = familyStats(reports);
    const metadata: Record<string, number | null> = {};
    for (const id of FIRST_PERSON_FAMILY_IDS) {
      metadata[`${id}.fires`] = stats[id].fires;
      metadata[`${id}.precision`] = precision(stats[id]);
      metadata[`${id}.mustNotHits`] = stats[id].mustNotHits;
    }
    metadata['strictRecall.core'] = (await rulesOnlyDev('core')).strictRecall ?? null;
    metadata['strictRecall.core+firstPerson'] =
      (await rulesOnlyDev('core+firstPerson')).strictRecall ?? null;
    createLogger({ sink: console, minLevel: 'info', enabled: true }).info(
      'first-person rule pack, rules-only dev guard',
      metadata,
    );
    expect(Object.keys(metadata)).toHaveLength(FIRST_PERSON_FAMILY_IDS.length * 3 + 2);
  });
});
