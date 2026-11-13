import { aggregateRuns } from '../../domain/evaluation/aggregateRuns';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import { evaluateGate } from '../../domain/evaluation/gate';
import { resolveReport, type ResolvedReport } from '../../domain/evaluation/resolveSpans';
import { summarizeCounts } from '../../domain/evaluation/summary';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type {
  EvalRunResult,
  EvalSplit,
  EvalSummary,
  EvaluateDetectionParams,
  ReportRunResult,
  SingleRunResult,
  StallCounts,
  ViewResult,
} from './evaluateDetection.types';
import { evaluateReport, type ViewName } from './evaluateReport';

export type {
  EvalProgress,
  EvalRunResult,
  EvalScan,
  EvalSplit,
  EvalSummary,
  EvalViews,
  EvaluateDetectionParams,
  ReportRunResult,
  SingleRunResult,
  StallCounts,
  VariantInfo,
  ViewResult,
} from './evaluateDetection.types';

function misconfigured(missing: string[], message: string): AppError {
  return createAppError('Misconfigured', { message, missing });
}

function selectReports(dataset: Dataset, split: EvalSplit): Result<ResolvedReport[], AppError> {
  const selected = dataset.reports.filter((r) => split === 'all' || r.split === split);
  if (selected.length === 0) return err(misconfigured([split], 'No reports in this split.'));
  const resolved: ResolvedReport[] = [];
  const problems: string[] = [];
  for (const report of selected) {
    const result = resolveReport(report);
    if (result.ok) resolved.push(result.value);
    else problems.push(...result.error.map((p) => `${p.reportId}:${p.code}:${p.path}`));
  }
  if (problems.length > 0) return err(misconfigured(problems, 'Dataset annotations are invalid.'));
  return ok(resolved);
}

/**
 * One run over the reports, strictly in order. A stalled report is a scan failure like any
 * other and the run goes on with the next report (§G.2); `stalls` counts how it ended.
 */
async function runOnce(
  params: EvaluateDetectionParams,
  reports: readonly ResolvedReport[],
  run: number,
  stalls: Record<keyof StallCounts, number>,
): Promise<Readonly<Record<ViewName, SingleRunResult>>> {
  const results: Record<ViewName, ReportRunResult[]> = { raw: [], filtered: [] };
  for (const report of reports) {
    const evaluated = await evaluateReport(report, params.scan);
    if (evaluated.stall !== null) stalls[evaluated.stall] += 1;
    results.raw.push(evaluated.raw);
    results.filtered.push(evaluated.filtered);
    params.onProgress?.({
      run,
      runs: params.runs,
      reportsDone: results.filtered.length,
      reports: reports.length,
      reportId: report.id,
    });
  }
  const single = (view: ViewName): SingleRunResult => ({
    run,
    reports: results[view],
    metrics: summarizeCounts(results[view].map((r) => r.counts)),
  });
  return { raw: single('raw'), filtered: single('filtered') };
}

function summarizeRuns(runs: readonly SingleRunResult[], reportCount: number): EvalSummary {
  const allCounts = runs.flatMap((r) => r.reports.map((report) => report.counts));
  return {
    reports: reportCount,
    pooled: summarizeCounts(allCounts),
    metrics: aggregateRuns(runs.map((r) => r.metrics)),
  };
}

function toView(
  runs: readonly SingleRunResult[],
  reportCount: number,
  split: EvalSplit,
): ViewResult {
  const summary = summarizeRuns(runs, reportCount);
  return {
    runs,
    summary,
    gate: split === 'test' ? evaluateGate(summary.pooled, summary.metrics) : null,
  };
}

/**
 * Evaluates detection quality: runs the selected reports sequentially, `runs` times,
 * and returns per-run metrics, pooled rates, mean/min/max and (test split only) the
 * gate verdict, for the raw and the post-filtered view of the same scans (top-level
 * runs/summary/gate are the filtered view). Rule findings are recomputed here so origin
 * attribution does not depend on merge order. Fails with Misconfigured when the split is
 * empty, `runs` is below 1 or annotations do not resolve.
 */
export async function evaluateDetection(
  params: EvaluateDetectionParams,
): Promise<Result<EvalRunResult, AppError>> {
  if (!Number.isInteger(params.runs) || params.runs < 1) {
    return err(misconfigured(['runs'], 'The run count must be a positive integer.'));
  }
  const reports = selectReports(params.dataset, params.split);
  if (!reports.ok) return reports;
  const startedAt = params.clock.now();
  const rawRuns: SingleRunResult[] = [];
  const filteredRuns: SingleRunResult[] = [];
  const stalls = { recovered: 0, terminal: 0 };
  for (let run = 1; run <= params.runs; run++) {
    const once = await runOnce(params, reports.value, run, stalls);
    rawRuns.push(once.raw);
    filteredRuns.push(once.filtered);
  }
  const count = reports.value.length;
  const filtered = toView(filteredRuns, count, params.split);
  const { variant } = params;
  return ok({
    datasetVersion: params.dataset.version,
    promptVersion: variant.promptVersion,
    strategy: variant.strategy,
    variant,
    split: params.split,
    startedAt,
    ...filtered,
    views: { raw: toView(rawRuns, count, params.split), filtered },
    stalls,
  });
}
