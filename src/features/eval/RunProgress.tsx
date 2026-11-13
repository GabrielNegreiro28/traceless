import { formatDuration } from './formatMetric';
import type { RunState } from './useEvalRunner';

export function RunProgress({ state }: { readonly state: RunState }) {
  if (state.phase !== 'running') return null;
  const { progress, elapsedMs, lastLatencyMs, variant } = state;
  return (
    <section className="rounded-md border border-border bg-surface p-4" aria-live="polite">
      <h2 className="font-semibold">Running...</h2>
      <p className="mt-1 text-warning">Keep this tab open and in the foreground.</p>
      <ul className="mt-2 space-y-1 text-muted">
        <li>
          Variant {variant.index}/{variant.total} ({variant.id})
        </li>
        <li>
          {progress === null
            ? 'Starting...'
            : `Run ${progress.run}/${progress.runs}, report ${progress.reportsDone}/${progress.reports} (${progress.reportId})`}
        </li>
        <li>Elapsed: {formatDuration(elapsedMs)}</li>
        {lastLatencyMs !== null && <li>Last report took {Math.round(lastLatencyMs)} ms</li>}
      </ul>
    </section>
  );
}
