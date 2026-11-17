import { describe, expect, it } from 'vitest';
import type { Candidate } from '../../domain/detection/candidates/candidateTypes';
import type { TextSpan } from '../../domain/detection/types';
import { spansMatch } from '../../domain/evaluation/matching';
import { resolveReport, type ResolvedReport } from '../../domain/evaluation/resolveSpans';
import { toRawText } from '../../domain/text/brandedText';
import { createLogger } from '../../shared/logger';
import { loadEvalDataset } from '../../test/evalDataset';
import { CompromiseCandidateFinder } from './compromiseCandidates';

/**
 * Headless metric of Layer 2 (plan zippy-floating-parasol, "candidate recall"): on the whole
 * v1 dev pool (24 reports), the share of gold quotes covered by some candidate (overlap ≥ 0.5),
 * per category, the mean candidate count and how often must-not spans are hit. Output is one
 * summary line of counts and rates: never report text or quotes.
 */
const FLOOR_RECALL = 0.9;
const MAX_MEAN_CANDIDATES = 25;
const MAX_ACCUSED_HIT_RATE = 0.25;

interface Tally {
  hit: number;
  total: number;
}

function rate({ hit, total }: Tally): number {
  return total === 0 ? 0 : hit / total;
}

function bump(tallies: Map<string, Tally>, key: string, covered: boolean): void {
  const tally = tallies.get(key) ?? { hit: 0, total: 0 };
  tallies.set(key, { hit: tally.hit + (covered ? 1 : 0), total: tally.total + 1 });
}

function covered(span: TextSpan, candidates: readonly Candidate[]): boolean {
  return candidates.some((c) => spansMatch(c.span, span));
}

function resolvedPool(): ResolvedReport[] {
  return loadEvalDataset().reports.map((r) => {
    const resolved = resolveReport(r);
    if (!resolved.ok) throw new Error('dataset annotations do not resolve');
    return resolved.value;
  });
}

async function measure() {
  const finder = new CompromiseCandidateFinder();
  const gold = new Map<string, Tally>();
  const mustNot = new Map<string, Tally>();
  let candidateCount = 0;
  const reports = resolvedPool();
  for (const report of reports) {
    const found = await finder.find(toRawText(report.text));
    if (!found.ok) throw new Error(`candidate finder failed: ${found.error.kind}`);
    candidateCount += found.value.length;
    for (const g of report.gold) bump(gold, g.category, covered(g.span, found.value));
    for (const m of report.mustNot) bump(mustNot, m.kind, covered(m.span, found.value));
  }
  const all = [...gold.values()].reduce(
    (a, t) => ({ hit: a.hit + t.hit, total: a.total + t.total }),
    {
      hit: 0,
      total: 0,
    },
  );
  return { gold, mustNot, all, meanCandidates: candidateCount / reports.length };
}

function summaryLine(m: Awaited<ReturnType<typeof measure>>): string {
  const fmt = (t: Map<string, Tally>) =>
    [...t.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${rate(v).toFixed(3)}(${v.hit}/${v.total})`)
      .join(' ');
  return `candidateRecall=${rate(m.all).toFixed(3)} meanCandidates=${m.meanCandidates.toFixed(1)} | ${fmt(m.gold)} | mustNotHit ${fmt(m.mustNot)}`;
}

const log = createLogger({ sink: console, minLevel: 'info', enabled: true });

describe('Layer 2 candidate recall on the v1 dev pool', () => {
  it('covers the gold self-disclosures with a small candidate list', async () => {
    const m = await measure();
    log.info(summaryLine(m));
    expect(rate(m.all)).toBeGreaterThanOrEqual(FLOOR_RECALL);
    expect(m.meanCandidates).toBeLessThanOrEqual(MAX_MEAN_CANDIDATES);
    expect(rate(m.mustNot.get('ACCUSED') ?? { hit: 0, total: 0 })).toBeLessThanOrEqual(
      MAX_ACCUSED_HIT_RATE,
    );
  }, 60_000);
});
