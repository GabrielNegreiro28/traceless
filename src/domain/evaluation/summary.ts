import { APP_ERROR_KINDS } from '../../shared/appError';
import { FINDING_CATEGORIES } from '../detection/types';
import { MUST_NOT_KINDS } from './datasetSchema';
import type { ReportCounts } from './evalTypes';

/**
 * Flat metric map; `null` means the denominator was zero (metric undefined).
 *
 * Normalisation (all micro-averaged: ratio of sums). "Scanned" = successful scans only;
 * "All" metrics also count the gold of failed scans as missed.
 * - combinedRecall = gold matched by any merged finding / gold of scanned reports
 * - combinedRecallAll = same numerator / gold of all reports
 * - strictRecall(All) = like combinedRecall(All), but only findings that are not oversized
 *   for that gold can hit it
 * - modelOnlyRecall = gold the rule findings missed that a pre-merge located model finding
 *   matched / gold the rule findings missed
 * - softPrecision = findings matching a gold span without being oversized for it / findings
 * - goldCoverage = mean over matched gold of |gold intersect union(findings)| / |gold|
 * - recall:CATEGORY = matched gold of that category / gold of that category
 * - categoryAccuracy = matched gold whose best-overlap matching finding has the gold
 *   category / matched gold
 * - violation:KIND = must-not spans of that kind matched by any merged finding / must-not
 *   spans of that kind; violation:KIND:RULE uses the rule findings and :MODEL the pre-merge
 *   located model findings
 * - oversizedRate = oversized findings / findings
 * - hallucinatedQuoteRate = unlocatedModelFindings / rawModelFindings
 * - invalidOutputRate = scans failed with InvalidModelOutput / all scans
 * - scanFailureRate = scans that failed for any reason / all scans; scanFailure:KIND per kind
 * - latencyP50Ms / latencyMaxMs = nearest-rank median / maximum of successful scan durations
 */
export type MetricSet = Readonly<Record<string, number | null>>;

export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function sum(counts: readonly ReportCounts[], pick: (c: ReportCounts) => number): number {
  return counts.reduce((total, c) => total + pick(c), 0);
}

/** Nearest-rank percentile (p in 0..1); null for an empty list. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[rank - 1] as number;
}

function mustNotMetrics(counts: readonly ReportCounts[]): Record<string, number | null> {
  const metrics: Record<string, number | null> = {};
  for (const kind of MUST_NOT_KINDS) {
    const total = sum(counts, (c) => c.mustNot[kind].total);
    metrics[`violation:${kind}`] = ratio(
      sum(counts, (c) => c.mustNot[kind].flagged),
      total,
    );
    for (const origin of ['RULE', 'MODEL'] as const) {
      metrics[`violation:${kind}:${origin}`] = ratio(
        sum(counts, (c) => c.mustNot[kind].flaggedBy[origin]),
        total,
      );
    }
  }
  return metrics;
}

function categoryMetrics(counts: readonly ReportCounts[]): Record<string, number | null> {
  const metrics: Record<string, number | null> = {};
  for (const category of FINDING_CATEGORIES) {
    metrics[`recall:${category}`] = ratio(
      sum(counts, (c) => c.perCategory[category].hit),
      sum(counts, (c) => c.perCategory[category].total),
    );
  }
  return metrics;
}

function failureMetrics(counts: readonly ReportCounts[]): Record<string, number | null> {
  const failed = (kind?: string): number =>
    counts.filter((c) => c.errorKind !== null && (kind === undefined || c.errorKind === kind))
      .length;
  const metrics: Record<string, number | null> = {
    scanFailureRate: ratio(failed(), counts.length),
    invalidOutputRate: ratio(failed('InvalidModelOutput'), counts.length),
  };
  for (const kind of APP_ERROR_KINDS) {
    metrics[`scanFailure:${kind}`] = ratio(failed(kind), counts.length);
  }
  return metrics;
}

function recallMetrics(counts: readonly ReportCounts[]): Record<string, number | null> {
  const goldTotal = sum(counts, (c) => c.goldTotal);
  const goldAll = sum(counts, (c) => c.goldAll);
  const goldHit = sum(counts, (c) => c.goldHit);
  const strictHit = sum(counts, (c) => c.strictHit);
  return {
    combinedRecall: ratio(goldHit, goldTotal),
    combinedRecallAll: ratio(goldHit, goldAll),
    strictRecall: ratio(strictHit, goldTotal),
    strictRecallAll: ratio(strictHit, goldAll),
    modelOnlyRecall: ratio(
      sum(counts, (c) => c.modelRecovered),
      sum(counts, (c) => c.ruleMissed),
    ),
    categoryAccuracy: ratio(
      sum(counts, (c) => c.categoryCorrect),
      goldHit,
    ),
    goldCoverage: ratio(
      sum(counts, (c) => c.coverageSum),
      goldHit,
    ),
  };
}

/** Aggregates the tallies of any number of reports (or runs, pooled) into one MetricSet. */
export function summarizeCounts(counts: readonly ReportCounts[]): MetricSet {
  const durations = counts.flatMap((c) => (c.durationMs === null ? [] : [c.durationMs]));
  const findings = sum(counts, (c) => c.findings);
  return {
    ...recallMetrics(counts),
    softPrecision: ratio(
      sum(counts, (c) => c.findingsCorrect),
      findings,
    ),
    oversizedRate: ratio(
      sum(counts, (c) => c.oversized),
      findings,
    ),
    hallucinatedQuoteRate: ratio(
      sum(counts, (c) => c.unlocatedModelFindings),
      sum(counts, (c) => c.rawModelFindings),
    ),
    ...categoryMetrics(counts),
    ...mustNotMetrics(counts),
    ...failureMetrics(counts),
    latencyP50Ms: percentile(durations, 0.5),
    latencyMaxMs: durations.length === 0 ? null : Math.max(...durations),
  };
}
