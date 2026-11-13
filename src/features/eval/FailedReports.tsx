import type { EvalRunResult } from '../../application/usecases/evaluateDetection';
import type { AppErrorKind } from '../../shared/appError';
import { friendlyKindMessage } from './errorMessages';

interface Failure {
  readonly kind: AppErrorKind;
  readonly count: number;
  readonly reportIds: readonly string[];
}

/** Failed scans grouped by error kind, over all runs. Ids and counts only, never text. */
function groupFailures(result: EvalRunResult): Failure[] {
  const groups = new Map<AppErrorKind, { count: number; ids: Set<string> }>();
  for (const run of result.runs) {
    for (const report of run.reports) {
      if (report.errorKind === null) continue;
      const group = groups.get(report.errorKind) ?? { count: 0, ids: new Set<string>() };
      group.count += 1;
      group.ids.add(report.reportId);
      groups.set(report.errorKind, group);
    }
  }
  return [...groups].map(([kind, g]) => ({ kind, count: g.count, reportIds: [...g.ids] }));
}

export function FailedReports({ result }: { readonly result: EvalRunResult }) {
  const failures = groupFailures(result);
  if (failures.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="font-semibold">Failed reports</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {failures.map(({ kind, count, reportIds }) => (
          <li key={kind}>
            <strong className="text-danger">{count}x</strong> {friendlyKindMessage(kind)} (reports:{' '}
            {reportIds.join(', ')})
          </li>
        ))}
      </ul>
    </div>
  );
}
