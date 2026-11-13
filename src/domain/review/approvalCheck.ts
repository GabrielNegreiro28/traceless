import type { Finding } from '../detection/types';
import type { ReviewDecision } from '../rewrite/reviewDecision';
import type { RiskAssessment, RiskLevel } from '../risk/riskScorer';
import type { RawText } from '../text/brandedText';
import { assessDirectIdentifiers, type DirectIdentifierStatus } from './directIdentifiers';
import { remainingRisk } from './reviewState';

/** What approval would find for a reviewed text (no text in it, only counts and the risk). */
export interface ApprovalAssessment {
  readonly direct: DirectIdentifierStatus;
  readonly risk: RiskAssessment;
  /** The reporter must confirm they accept the remaining risk before approving. */
  readonly acknowledgementRequired: boolean;
}

/**
 * The single acknowledgement rule (design plan §0): a MEDIUM/HIGH residual risk, or a direct
 * identifier the reporter kept on purpose, needs explicit acknowledgement. approveReport and
 * the outbox both use it, so the gate and the checkbox cannot drift apart.
 */
export function isAcknowledgementRequired(
  level: RiskLevel,
  keptDirectIdentifiers: number,
): boolean {
  return level === 'MEDIUM' || level === 'HIGH' || keptDirectIdentifiers > 0;
}

/** Assesses a review whose decisions turned `originalText` into `rewrittenText`. */
export function assessApproval(
  originalText: RawText,
  rewrittenText: RawText,
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): ApprovalAssessment {
  const direct = assessDirectIdentifiers(originalText, rewrittenText, findings, decisions);
  const risk = remainingRisk(findings, decisions);
  return {
    direct,
    risk,
    acknowledgementRequired: isAcknowledgementRequired(risk.level, direct.keptAtRisk),
  };
}
