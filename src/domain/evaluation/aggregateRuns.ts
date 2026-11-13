import type { MetricSet } from './summary';

export interface MetricStats {
  /** Over the runs where the metric was defined; null when it never was. */
  readonly mean: number | null;
  readonly min: number | null;
  readonly max: number | null;
  /** Number of runs in which the metric was undefined (null). */
  readonly missingRuns: number;
}

export type AggregatedMetrics = Readonly<Record<string, MetricStats>>;

function statsOf(values: readonly number[], runs: number): MetricStats {
  const missingRuns = runs - values.length;
  if (values.length === 0) return { mean: null, min: null, max: null, missingRuns };
  const total = values.reduce((a, b) => a + b, 0);
  return {
    mean: total / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    missingRuns,
  };
}

/** Mean/min/max of every metric across N runs, plus how many runs lacked a value. */
export function aggregateRuns(runs: readonly MetricSet[]): AggregatedMetrics {
  const names = new Set(runs.flatMap((run) => Object.keys(run)));
  const result: Record<string, MetricStats> = {};
  for (const name of names) {
    const values = runs.flatMap((run) => {
      const value = run[name];
      return typeof value === 'number' ? [value] : [];
    });
    result[name] = statsOf(values, runs.length);
  }
  return result;
}
