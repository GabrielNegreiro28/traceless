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

/** The scan variant an evaluation ran with. Labels only. */
export interface VariantInfo {
  readonly id: string;
  readonly promptVersion: string;
  readonly strategy: string;
  readonly chunkChars: number;
  readonly postFilters: readonly string[];
}

export interface EvaluateDetectionParams {
  readonly dataset: Dataset;
  readonly split: EvalSplit;
  /** Wraps scanReport with any scanner; the use case never sees scanners or prompts. */
  readonly scan: EvalScan;
  readonly clock: Clock;
  readonly runs: number;
  /** Copied into the result (application must not import ai/prompts or features). */
  readonly variant: VariantInfo;
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

/** Runs, pooled summary and gate for one view of the findings. */
export interface ViewResult {
  readonly runs: readonly SingleRunResult[];
  readonly summary: EvalSummary;
  /** Only evaluated on the test split; null otherwise. */
  readonly gate: GateResult | null;
}

/**
 * On-device stalls during an evaluation (docs/design/fase2-gate-iteration.md §G.2), counted
 * per scanned report: `recovered` = recoveries (the stalled model was abandoned and later scans
 * ran on a fresh one); `terminal` = stalls the page load could not recover from, including the
 * later scans that failed fast because of one. Every stalled report also counts as a scan
 * failure in the metrics.
 */
export interface StallCounts {
  readonly recovered: number;
  readonly terminal: number;
}

/** `raw` = model output as scanned; `filtered` = after post-filters (the shipping pipeline). */
export interface EvalViews {
  readonly raw: ViewResult;
  readonly filtered: ViewResult;
}

/**
 * JSON-serialisable result of an evaluation (all fields are plain data, spans and
 * labels only). `runs`, `summary` and `gate` are the filtered view, i.e. what ships.
 */
export interface EvalRunResult extends ViewResult {
  readonly datasetVersion: string;
  readonly promptVersion: string;
  readonly strategy: string;
  readonly variant: VariantInfo;
  readonly split: EvalSplit;
  readonly startedAt: number;
  readonly views: EvalViews;
  /** Added with §G.2: result files saved before it have no `stalls` (read it as unknown). */
  readonly stalls: StallCounts;
}
