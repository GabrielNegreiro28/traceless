import type { AccusedBand, GateCheck } from '../../domain/evaluation/gate';
import { downloadJson } from './downloadJson';
import { friendlyErrorMessage } from './errorMessages';
import { FailedReports } from './FailedReports';
import { formatMetric } from './formatMetric';
import type { RunState, VariantOutcome } from './useEvalRunner';

const SUMMARY_METRICS: readonly (readonly [string, string])[] = [
  ['strictRecallAll', 'Strict recall (failed scans count as missed)'],
  ['combinedRecall', 'Recall (scanned reports)'],
  ['modelOnlyRecall', 'Recall of what rules missed (model only)'],
  ['softPrecision', 'Precision'],
  ['violation:ACCUSED', 'Accused people flagged'],
  ['violation:INCIDENT_FACT', 'Incident facts flagged'],
  ['invalidOutputRate', 'Invalid model output'],
  ['scanFailureRate', 'Failed scans'],
  ['oversizedRate', 'Oversized findings'],
  ['latencyP50Ms', 'Median scan time'],
  ['latencyMaxMs', 'Slowest scan'],
];

const BAND_NOTES: Readonly<Record<AccusedBand, string>> = {
  PASS: 'within the 5% limit',
  CONDITIONAL:
    'between 5% and 15%: ship only with the protected-chips confirmation and the real number in the README',
  FAIL: 'above 15%: needs Plan C (a subject check) before more review work',
};

function gateLabel(check: GateCheck): string {
  if (!check.pass) return 'FAIL';
  return check.unstable ? 'UNSTABLE' : 'PASS';
}

function SummaryTable({ outcome }: { readonly outcome: VariantOutcome }) {
  const { pooled, metrics } = outcome.result.summary;
  return (
    <table className="mt-3 w-full text-left text-sm">
      <thead>
        <tr className="text-muted">
          <th scope="col">Metric</th>
          <th scope="col">Pooled</th>
          <th scope="col">Min</th>
          <th scope="col">Max</th>
        </tr>
      </thead>
      <tbody>
        {SUMMARY_METRICS.map(([key, label]) => (
          <tr key={key} className="border-t border-border">
            <td className="py-1">{label}</td>
            <td>{formatMetric(key, pooled[key])}</td>
            <td>{formatMetric(key, metrics[key]?.min)}</td>
            <td>{formatMetric(key, metrics[key]?.max)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GateList({ outcome }: { readonly outcome: VariantOutcome }) {
  const { gate } = outcome.result;
  if (gate === null) {
    return (
      <p className="mt-3 text-muted">The go/no-go checklist only applies to the test split.</p>
    );
  }
  return (
    <div className="mt-4">
      <h3 className="font-semibold">Go/no-go checklist: {gate.pass ? 'PASS' : 'FAIL'}</h3>
      <p className="text-sm">
        ACCUSED band: <strong>{gate.accusedBand}</strong> ({BAND_NOTES[gate.accusedBand]})
      </p>
      <ul className="mt-1 space-y-1 text-sm">
        {gate.checks.map((check) => (
          <li key={check.metric}>
            <strong className={check.pass ? 'text-accent' : 'text-danger'}>
              {gateLabel(check)}
            </strong>{' '}
            {check.name}: {formatMetric(check.metric, check.pooled)} (needs {check.comparison}{' '}
            {formatMetric(check.metric, check.threshold)}; worst run{' '}
            {formatMetric(check.metric, check.worstRun)})
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveNotice({ outcome }: { readonly outcome: VariantOutcome }) {
  if (outcome.save.kind === 'saved') {
    return <p className="mt-4">Saved to eval/results/{outcome.save.file}</p>;
  }
  return (
    <p className="mt-4 text-danger">
      Could not save the file: {friendlyErrorMessage(outcome.save.error)} Use "Download JSON"
      instead.
    </p>
  );
}

function VariantResults({ outcome }: { readonly outcome: VariantOutcome }) {
  const { result, variant } = outcome;
  const fileName = `${variant.id}-${result.split}.json`;
  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="font-semibold">
        Variant {variant.id} ({variant.promptVersion}, {variant.strategy}, {variant.chunkChars}{' '}
        chars)
      </h3>
      <SummaryTable outcome={outcome} />
      <GateList outcome={outcome} />
      <FailedReports result={result} />
      <SaveNotice outcome={outcome} />
      <button
        type="button"
        onClick={() => downloadJson(fileName, result)}
        className="mt-3 rounded-md border border-border px-4 py-2 font-medium"
      >
        Download JSON ({variant.id})
      </button>
    </div>
  );
}

export function EvalResults({ state }: { readonly state: RunState }) {
  if (state.phase !== 'done') return null;
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <h2 className="font-semibold">Results ({state.preset.label})</h2>
      {state.outcomes.map((outcome) => (
        <VariantResults key={outcome.variant.id} outcome={outcome} />
      ))}
    </section>
  );
}
