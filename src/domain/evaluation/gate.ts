import type { AggregatedMetrics } from './aggregateRuns';
import type { MetricSet } from './summary';

/** Go/no-go thresholds (docs/design/fase2-ai-layer.md section 4); test split only. */
export const GATE_THRESHOLDS = {
  strictRecallAll: 0.7,
  accusedViolations: 0.05,
  incidentFactViolations: 0.1,
  invalidOutputRate: 0.05,
  scanFailureRate: 0.05,
  oversizedRate: 0.25,
  /** Pre-registered 2026-11-13 (docs/design/fase2-gate-iteration.md section D). */
  softPrecision: 0.35,
  latencyP50Ms: 20_000,
  latencyMaxMs: 60_000,
} as const;

/** ACCUSED band: <= pass limit passes, <= conditional limit ships only with the chips UI. */
export const ACCUSED_BANDS = { pass: 0.05, conditional: 0.15 } as const;

export type AccusedBand = 'PASS' | 'CONDITIONAL' | 'FAIL';

export interface GateCriterion {
  readonly name: string;
  readonly metric: string;
  readonly comparison: '>=' | '<=';
  readonly threshold: number;
}

export const GATE_CRITERIA: readonly GateCriterion[] = [
  {
    name: 'strict recall (failed scans count as missed)',
    metric: 'strictRecallAll',
    comparison: '>=',
    threshold: GATE_THRESHOLDS.strictRecallAll,
  },
  {
    name: 'ACCUSED violations',
    metric: 'violation:ACCUSED',
    comparison: '<=',
    threshold: GATE_THRESHOLDS.accusedViolations,
  },
  {
    name: 'INCIDENT_FACT violations',
    metric: 'violation:INCIDENT_FACT',
    comparison: '<=',
    threshold: GATE_THRESHOLDS.incidentFactViolations,
  },
  {
    name: 'invalid output',
    metric: 'invalidOutputRate',
    comparison: '<=',
    threshold: GATE_THRESHOLDS.invalidOutputRate,
  },
  {
    name: 'scan failures',
    metric: 'scanFailureRate',
    comparison: '<=',
    threshold: GATE_THRESHOLDS.scanFailureRate,
  },
  {
    name: 'oversized findings',
    metric: 'oversizedRate',
    comparison: '<=',
    threshold: GATE_THRESHOLDS.oversizedRate,
  },
  {
    name: 'precision (findings matching gold)',
    metric: 'softPrecision',
    comparison: '>=',
    threshold: GATE_THRESHOLDS.softPrecision,
  },
  {
    name: 'median scan time (all scans of all runs)',
    metric: 'latencyP50Ms',
    comparison: '<=',
    threshold: GATE_THRESHOLDS.latencyP50Ms,
  },
  {
    name: 'slowest scan (all scans of all runs)',
    metric: 'latencyMaxMs',
    comparison: '<=',
    threshold: GATE_THRESHOLDS.latencyMaxMs,
  },
];

export interface GateCheck extends GateCriterion {
  /** Rate pooled over all runs (sum of numerators / sum of denominators); the verdict. */
  readonly pooled: number | null;
  /** Worst single run: min for `>=` criteria, max for `<=` criteria. */
  readonly worstRun: number | null;
  /** Runs in which the metric was undefined. */
  readonly missingRuns: number;
  readonly pass: boolean;
  /** The pooled value passes but the worst run breaches the threshold. */
  readonly unstable: boolean;
}

export interface GateResult {
  readonly pass: boolean;
  /** Pooled ACCUSED rate band; CONDITIONAL needs the protected-chips confirmation in the UI. */
  readonly accusedBand: AccusedBand;
  readonly unstable: boolean;
  readonly checks: readonly GateCheck[];
}

function meets(criterion: GateCriterion, value: number | null): boolean {
  if (value === null) return false;
  return criterion.comparison === '>='
    ? value >= criterion.threshold
    : value <= criterion.threshold;
}

function check(criterion: GateCriterion, pooled: MetricSet, perRun: AggregatedMetrics): GateCheck {
  const value = pooled[criterion.metric] ?? null;
  const stats = perRun[criterion.metric];
  const missingRuns = stats?.missingRuns ?? 0;
  const worstRun = (criterion.comparison === '>=' ? stats?.min : stats?.max) ?? null;
  const pass = meets(criterion, value) && missingRuns === 0;
  return {
    ...criterion,
    pooled: value,
    worstRun,
    missingRuns,
    pass,
    unstable: pass && !meets(criterion, worstRun),
  };
}

/** Band of the pooled ACCUSED violation rate; an undefined rate fails. */
export function accusedBand(rate: number | null): AccusedBand {
  if (rate === null || rate > ACCUSED_BANDS.conditional) return 'FAIL';
  return rate <= ACCUSED_BANDS.pass ? 'PASS' : 'CONDITIONAL';
}

/**
 * Pass/fail per criterion on rates pooled over runs. A metric that is undefined in the
 * pooled data or in any run fails. `unstable` flags criteria whose worst run breaches
 * the threshold although the pooled value passes.
 */
export function evaluateGate(pooled: MetricSet, perRun: AggregatedMetrics): GateResult {
  const checks = GATE_CRITERIA.map((criterion) => check(criterion, pooled, perRun));
  return {
    pass: checks.every((c) => c.pass),
    accusedBand: accusedBand(pooled['violation:ACCUSED'] ?? null),
    unstable: checks.some((c) => c.unstable),
    checks,
  };
}
