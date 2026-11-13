const isLatency = (metric: string): boolean => metric.startsWith('latency');

/** Percent for rates, milliseconds for latencies, a dash when the metric is undefined. */
export function formatMetric(metric: string, value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return isLatency(metric) ? `${Math.round(value)} ms` : `${(value * 100).toFixed(1)}%`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
