import type { AggregatedMetrics } from '../../domain/evaluation/aggregateRuns';
import type { Dataset, Split } from '../../domain/evaluation/datasetSchema';
import type { GateResult } from '../../domain/evaluation/gate';
import type { EvalFinding, ReportCounts } from '../../domain/evaluation/reportCounts';
import type { MetricSet } from '../../domain/evaluation/summary';
import type { RawText } from '../../domain/text/brandedText';
import type { AppError, AppErrorKind } from '../../shared/appError';
import type { Result } from '../../shared/result';
import type { Clock } from '../ports/Clock';
import type { ScanReportResult } from './scanReport';

export type EvalSplit = Split | 'all';

export type EvalScan = (text: RawText) => Promise<Result<ScanReportResult, AppError>>;

export interface EvalProgress {
  /** 1-based run number. */
  readonly run: number;
  readonly runs: number;
  /** Number of reports finished in this run. */
  readonly reportsDone: number;
  readonly reports: number;
  readonly reportId: string;
}

export interface EvaluateDetectionParams {
  readonly dataset: Dataset;
  readonly split: EvalSplit;
  /** Wraps scanReport with any scanner; the use case never sees scanners or prompts. */
  readonly scan: EvalScan;
  readonly clock: Clock;
  readonly runs: number;
  /** Labels copied into the result (application must not import ai/prompts). */
  readonly promptVersion: string;
  readonly strategy: string;
  readonly onProgress?: (progress: EvalProgress) => void;
}

/** Per-report outcome. Holds spans and counts only, never report text or quotes. */
export interface ReportRunResult {
  readonly reportId: string;
  readonly split: Split;
  readonly ok: boolean;
  readonly errorKind: AppErrorKind | null;
  readonly findings: readonly EvalFinding[];
  readonly counts: ReportCounts;
  readonly metrics: MetricSet;
}

export interface SingleRunResult {
  readonly run: number;
  readonly reports: readonly ReportRunResult[];
  readonly metrics: MetricSet;
}

export interface EvalSummary {
  readonly reports: number;
  /** Rates pooled over all runs (sum of numerators / sum of denominators). */
  readonly pooled: MetricSet;
  /** Mean, min, max and missing-run count of each per-run metric. */
  readonly metrics: AggregatedMetrics;
}

/** JSON-serialisable result of an evaluation (all fields are plain data). */
export interface EvalRunResult {
  readonly datasetVersion: string;
  readonly promptVersion: string;
  readonly strategy: string;
  readonly split: EvalSplit;
  readonly startedAt: number;
  readonly runs: readonly SingleRunResult[];
  readonly summary: EvalSummary;
  /** Only evaluated on the test split; null otherwise. */
  readonly gate: GateResult | null;
}
