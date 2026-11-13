import { detectByRules } from '../../domain/detection/ruleDetector';
import {
  countReport,
  type EvalFinding,
  type ScanOutcome,
} from '../../domain/evaluation/reportCounts';
import type { ResolvedReport } from '../../domain/evaluation/resolveSpans';
import { summarizeCounts } from '../../domain/evaluation/summary';
import { toRawText, type RawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, type Result } from '../../shared/result';
import type { EvalScan, ReportRunResult } from './evaluateDetection.types';
import type { ScanReportResult } from './scanReport';

export type ViewName = 'raw' | 'filtered';

const toEvalFinding = ({ span, category, origin }: EvalFinding): EvalFinding => ({
  span,
  category,
  origin,
});

/** The findings of one view; without post-filters both views are the same findings. */
function findingsOf(value: ScanReportResult, view: ViewName): ScanReportResult {
  if (view === 'raw' || value.filtered === undefined) return value;
  return { ...value, ...value.filtered };
}

function toOutcome(
  result: Result<ScanReportResult, AppError>,
  ruleFindings: readonly EvalFinding[],
  view: ViewName,
): ScanOutcome {
  if (!result.ok) return { ok: false, errorKind: result.error.kind };
  const { findings, modelFindings } = findingsOf(result.value, view);
  const { stats } = result.value;
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

function reportResult(
  report: ResolvedReport,
  scanned: Result<ScanReportResult, AppError>,
  ruleFindings: readonly EvalFinding[],
  view: ViewName,
): ReportRunResult {
  const outcome = toOutcome(scanned, ruleFindings, view);
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

/** Scans the report once and evaluates the scan once per view. */
export async function evaluateReport(
  report: ResolvedReport,
  scan: EvalScan,
): Promise<Readonly<Record<ViewName, ReportRunResult>>> {
  const text = toRawText(report.text);
  const scanned = await safeScan(scan, text);
  const ruleFindings = detectByRules(text);
  return {
    raw: reportResult(report, scanned, ruleFindings, 'raw'),
    filtered: reportResult(report, scanned, ruleFindings, 'filtered'),
  };
}
