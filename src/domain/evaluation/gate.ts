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
} as const;

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

/**
 * Pass/fail per criterion on rates pooled over runs. A metric that is undefined in the
 * pooled data or in any run fails. `unstable` flags criteria whose worst run breaches
 * the threshold although the pooled value passes.
 */
export function evaluateGate(pooled: MetricSet, perRun: AggregatedMetrics): GateResult {
  const checks = GATE_CRITERIA.map((criterion) => check(criterion, pooled, perRun));
  return {
    pass: checks.every((c) => c.pass),
    unstable: checks.some((c) => c.unstable),
    checks,
  };
}
