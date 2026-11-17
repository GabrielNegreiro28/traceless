import type { AppErrorKind } from '../../shared/appError';
import type { ReportCounts, ReportEvalInput } from './evalTypes';
import { emptyPerCategory, findingTallies, goldTallies } from './goldCounts';
import { emptyMustNot, mustNotTallies } from './mustNotCounts';

export type {
  EvalFinding,
  MustNotCounts,
  ReportCounts,
  ReportEvalInput,
  ScanOutcome,
} from './evalTypes';

function failedCounts(errorKind: AppErrorKind, goldAll: number): ReportCounts {
  return {
    scanned: false,
    errorKind,
    durationMs: null,
    verifyMs: null,
    goldAll,
    goldTotal: 0,
    goldHit: 0,
    strictHit: 0,
    ruleMissed: 0,
    modelRecovered: 0,
    categoryCorrect: 0,
    coverageSum: 0,
    perCategory: emptyPerCategory(),
    findings: 0,
    findingsCorrect: 0,
    oversized: 0,
    mustNot: emptyMustNot(),
    rawModelFindings: 0,
    unlocatedModelFindings: 0,
  };
}

/**
 * Tallies one report. A failed scan contributes only `goldAll` and its error kind:
 * quality metrics are computed over successful scans, the All recalls count its
 * gold as missed, and scanFailureRate counts the failure itself.
 */
export function countReport(input: ReportEvalInput): ReportCounts {
  const { scan, gold, mustNot } = input;
  if (!scan.ok) return failedCounts(scan.errorKind, gold.length);
  const g = goldTallies(gold, scan.findings, scan.ruleFindings, scan.modelFindings);
  return {
    scanned: true,
    errorKind: null,
    durationMs: scan.durationMs,
    verifyMs: scan.verifyMs,
    goldAll: gold.length,
    goldTotal: gold.length,
    ...g,
    findings: scan.findings.length,
    ...findingTallies(scan.findings, gold),
    mustNot: mustNotTallies(mustNot, scan.findings, {
      RULE: scan.ruleFindings,
      MODEL: scan.modelFindings,
    }),
    rawModelFindings: scan.rawModelFindings,
    unlocatedModelFindings: scan.unlocatedModelFindings,
  };
}
