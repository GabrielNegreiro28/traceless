import type { AppErrorKind } from '../../shared/appError';
import type { Finding, FindingCategory, FindingOrigin } from '../detection/types';
import type { MustNotKind } from './datasetSchema';
import type { ResolvedGold, ResolvedMustNot } from './resolveSpans';

/** The part of a Finding the metrics need. */
export type EvalFinding = Pick<Finding, 'span' | 'category' | 'origin'>;

export type ScanOutcome =
  | {
      readonly ok: true;
      /** Merged findings (what the reporter would see). */
      readonly findings: readonly EvalFinding[];
      /** Deterministic rule findings of the full text, before merging. */
      readonly ruleFindings: readonly EvalFinding[];
      /** Located model findings, before merging. */
      readonly modelFindings: readonly EvalFinding[];
      readonly rawModelFindings: number;
      /** Raw model findings whose quote resolved to zero spans. */
      readonly unlocatedModelFindings: number;
      readonly durationMs: number;
      /** Time in the verifier pass (0 when the scan had none). */
      readonly verifyMs: number;
    }
  | { readonly ok: false; readonly errorKind: AppErrorKind };

export interface ReportEvalInput {
  readonly gold: readonly ResolvedGold[];
  readonly mustNot: readonly ResolvedMustNot[];
  readonly scan: ScanOutcome;
}

export interface MustNotCounts {
  readonly total: number;
  /** Must-not spans matched by at least one merged finding. */
  readonly flagged: number;
  /** Matched by a rule finding (RULE) / by a pre-merge located model finding (MODEL). */
  readonly flaggedBy: Readonly<Record<FindingOrigin, number>>;
}

export type CategoryTally = Readonly<Record<FindingCategory, { total: number; hit: number }>>;

/** Raw tallies for one report; every rate is a ratio of sums of these. */
export interface ReportCounts {
  readonly scanned: boolean;
  readonly errorKind: AppErrorKind | null;
  readonly durationMs: number | null;
  /** Time in the verifier pass; null when the scan failed. Absent in older result files. */
  readonly verifyMs: number | null;
  /** Gold spans of the report, counted even when the scan failed. */
  readonly goldAll: number;
  /** Gold spans of successfully scanned reports. */
  readonly goldTotal: number;
  readonly goldHit: number;
  /** Gold hit by a finding that is not oversized for that gold. */
  readonly strictHit: number;
  /** Gold spans no rule finding matched. */
  readonly ruleMissed: number;
  /** Of `ruleMissed`, those a pre-merge located model finding matched. */
  readonly modelRecovered: number;
  /** Matched gold whose best-overlap matching finding has the gold category. */
  readonly categoryCorrect: number;
  /** Sum over matched gold of the fraction of the gold covered by the findings. */
  readonly coverageSum: number;
  readonly perCategory: CategoryTally;
  readonly findings: number;
  /** Findings that match a gold span and are not oversized for it. */
  readonly findingsCorrect: number;
  readonly oversized: number;
  readonly mustNot: Readonly<Record<MustNotKind, MustNotCounts>>;
  readonly rawModelFindings: number;
  readonly unlocatedModelFindings: number;
}
