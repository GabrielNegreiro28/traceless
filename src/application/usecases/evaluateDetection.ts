import { detectByRules } from '../../domain/detection/ruleDetector';
import { aggregateRuns } from '../../domain/evaluation/aggregateRuns';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import { evaluateGate } from '../../domain/evaluation/gate';
import {
  countReport,
  type EvalFinding,
  type ScanOutcome,
} from '../../domain/evaluation/reportCounts';
import { resolveReport, type ResolvedReport } from '../../domain/evaluation/resolveSpans';
import { summarizeCounts } from '../../domain/evaluation/summary';
import { toRawText, type RawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { ScanReportResult } from './scanReport';
import type {
  EvalRunResult,
  EvalScan,
  EvalSplit,
  EvalSummary,
  EvaluateDetectionParams,
  ReportRunResult,
  SingleRunResult,
} from './evaluateDetection.types';

export type {
  EvalProgress,
  EvalRunResult,
  EvalScan,
  EvalSplit,
  EvalSummary,
  EvaluateDetectionParams,
  ReportRunResult,
  SingleRunResult,
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

const toEvalFinding = ({ span, category, origin }: EvalFinding): EvalFinding => ({
  span,
  category,
  origin,
});

function toOutcome(
  result: Result<ScanReportResult, AppError>,
  ruleFindings: readonly EvalFinding[],
): ScanOutcome {
  if (!result.ok) return { ok: false, errorKind: result.error.kind };
  const { findings, modelFindings, stats } = result.value;
  return {
    ok: true,
    findings: findings.map(toEvalFinding),
    ruleFindings: ruleFindings.map(toEvalFinding),
    modelFindings: modelFindings.map(toEvalFinding),
    rawModelFindings: stats.rawModelFindings,
    unlocatedModelFindings: stats.unlocatedModelFindings,
    durationMs: stats.durationMs,
  };
}

/** A rejected scan becomes an Unknown failure of that report; the message is never kept. */
async function safeScan(
  scan: EvalScan,
  text: RawText,
): Promise<Result<ScanReportResult, AppError>> {
  try {
    return await scan(text);
  } catch {
    return err(createAppError('Unknown', { message: 'The scan function threw.' }));
  }
}

async function evaluateReport(report: ResolvedReport, scan: EvalScan): Promise<ReportRunResult> {
  const text = toRawText(report.text);
  const result = await safeScan(scan, text);
  const outcome = toOutcome(result, detectByRules(text));
  const counts = countReport({ gold: report.gold, mustNot: report.mustNot, scan: outcome });
  return {
    reportId: report.id,
    split: report.split,
    ok: outcome.ok,
    errorKind: counts.errorKind,
    findings: outcome.ok ? outcome.findings : [],
    counts,
    metrics: summarizeCounts([counts]),
  };
}

async function runOnce(
  params: EvaluateDetectionParams,
  reports: readonly ResolvedReport[],
  run: number,
): Promise<SingleRunResult> {
  const results: ReportRunResult[] = [];
  for (const report of reports) {
    results.push(await evaluateReport(report, params.scan));
    params.onProgress?.({
      run,
      runs: params.runs,
      reportsDone: results.length,
      reports: reports.length,
      reportId: report.id,
    });
  }
  return { run, reports: results, metrics: summarizeCounts(results.map((r) => r.counts)) };
}

function summarizeRuns(runs: readonly SingleRunResult[], reportCount: number): EvalSummary {
  const allCounts = runs.flatMap((r) => r.reports.map((report) => report.counts));
  return {
    reports: reportCount,
    pooled: summarizeCounts(allCounts),
    metrics: aggregateRuns(runs.map((r) => r.metrics)),
  };
}

/**
 * Evaluates detection quality: runs the selected reports sequentially, `runs` times,
 * and returns per-run metrics, pooled rates, mean/min/max and (test split only) the
 * gate verdict. Rule findings are recomputed here so origin attribution does not
 * depend on merge order. Fails with Misconfigured when the split is empty, `runs` is
 * below 1 or annotations do not resolve.
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
  const runs: SingleRunResult[] = [];
  for (let run = 1; run <= params.runs; run++) {
    runs.push(await runOnce(params, reports.value, run));
  }
  const summary = summarizeRuns(runs, reports.value.length);
  return ok({
    datasetVersion: params.dataset.version,
    promptVersion: params.promptVersion,
    strategy: params.strategy,
    split: params.split,
    startedAt,
    runs,
    summary,
    gate: params.split === 'test' ? evaluateGate(summary.pooled, summary.metrics) : null,
  });
}
