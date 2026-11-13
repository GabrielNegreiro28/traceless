import type { Finding } from '../../domain/detection/types';
import {
  assessDirectIdentifiers,
  type DirectIdentifierStatus,
} from '../../domain/review/directIdentifiers';
import { remainingRisk } from '../../domain/review/reviewState';
import { applyDecisions, type ReviewDecision } from '../../domain/rewrite/rewriteApplier';
import type { RiskAssessment } from '../../domain/risk/riskScorer';
import {
  unsafeCreateSanitizedText,
  type RawText,
  type SanitizedText,
} from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { Clock } from '../ports/Clock';

export interface ApproveReportInput {
  readonly text: RawText;
  readonly findings: readonly Finding[];
  readonly decisions: readonly ReviewDecision[];
  /** The reporter confirmed they accept the identification risk that remains. */
  readonly acknowledgedRemainingRisk: boolean;
}

export interface ApproveReportDeps {
  readonly clock: Clock;
}

export interface ApprovedReport {
  readonly text: SanitizedText;
  readonly remainingRisk: RiskAssessment;
  readonly approvedAt: number;
}

/** Fixed messages: never include report text. */
function checkApprovable(
  finalText: string,
  direct: DirectIdentifierStatus,
  risk: RiskAssessment,
  acknowledged: boolean,
): Result<void, AppError> {
  if (finalText.trim() === '') {
    return err(createAppError('EmptyReport', { message: 'The approved report would be empty.' }));
  }
  if (direct.undecided > 0) {
    const message = 'Every direct identifier must be rewritten or explicitly kept before approval.';
    return err(createAppError('DirectIdentifierRemains', { message, count: direct.undecided }));
  }
  const riskyLevel = risk.level === 'MEDIUM' || risk.level === 'HIGH';
  if ((riskyLevel || direct.keptAtRisk > 0) && !acknowledged) {
    const message = 'The remaining identification risk must be acknowledged before approval.';
    return err(createAppError('RiskNotAcknowledged', { message, level: risk.level }));
  }
  return ok(undefined);
}

/**
 * The ONLY place that creates SanitizedText (PLANO §1.4, enforced by ESLint).
 *
 * 1. Applies the review decisions (rewriteApplier); a blank result is EmptyReport.
 * 2. Re-runs the deterministic rules on the final text and refuses approval while any
 *    direct identifier is undecided (pending, mangled or new); KEPT_RISK/NOT_ABOUT_ME
 *    ones stay (see assessDirectIdentifiers).
 * 3. Residual risk = scoreRisk(pending + KEPT_RISK findings). A kept direct identifier or
 *    a MEDIUM/HIGH residual risk requires `acknowledgedRemainingRisk`.
 */
export function approveReport(
  input: ApproveReportInput,
  deps: ApproveReportDeps,
): Result<ApprovedReport, AppError> {
  const { text, findings, decisions } = input;
  const rewritten = applyDecisions(text, findings, decisions);
  if (!rewritten.ok) return rewritten;
  const direct = assessDirectIdentifiers(text, rewritten.value, findings, decisions);
  const risk = remainingRisk(findings, decisions);
  const check = checkApprovable(rewritten.value, direct, risk, input.acknowledgedRemainingRisk);
  if (!check.ok) return check;
  return ok({
    text: unsafeCreateSanitizedText(rewritten.value),
    remainingRisk: risk,
    approvedAt: deps.clock.now(),
  });
}
