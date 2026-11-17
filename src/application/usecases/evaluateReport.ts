import { detectByRules } from '../../domain/detection/ruleDetector';
import type { RulePack } from '../../domain/detection/rulePacks';
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
import type { EvalScan, ReportRunResult, StallCounts } from './evaluateDetection.types';
import type { ScanReportResult, UnfilteredFindings } from './scanReport';

export type ViewName = 'raw' | 'filtered';

/** One report's scan, evaluated per view, and whether it ended in an on-device stall. */
export interface EvaluatedReport extends Readonly<Record<ViewName, ReportRunResult>> {
  readonly stall: keyof StallCounts | null;
}

const toEvalFinding = ({ span, category, origin }: EvalFinding): EvalFinding => ({
  span,
  category,
  origin,
});

/** `filtered` = what ships (post-filtered); `raw` = the same scan before the post-filters. */
function findingsOf(value: ScanReportResult, view: ViewName): UnfilteredFindings {
  return view === 'raw' ? value.raw : value;
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
    verifyMs: stats.verifyMs,
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

/** A stalled scan (OnDeviceStuck) is a scan failure; this only labels how it ended. */
function stallOf(scanned: Result<ScanReportResult, AppError>): EvaluatedReport['stall'] {
  if (scanned.ok || scanned.error.kind !== 'OnDeviceStuck') return null;
  return scanned.error.recoverable ? 'recovered' : 'terminal';
}

/**
 * Scans the report once and evaluates the scan once per view. RULE-origin attribution uses
 * the rule findings of `rulePack`, the pack the scan itself ran.
 */
export async function evaluateReport(
  report: ResolvedReport,
  scan: EvalScan,
  rulePack: RulePack,
): Promise<EvaluatedReport> {
  const text = toRawText(report.text);
  const scanned = await safeScan(scan, text);
  const ruleFindings = detectByRules(text, rulePack);
  return {
    raw: reportResult(report, scanned, ruleFindings, 'raw'),
    filtered: reportResult(report, scanned, ruleFindings, 'filtered'),
    stall: stallOf(scanned),
  };
}
