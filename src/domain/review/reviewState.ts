import { spanContains } from '../detection/span';
import type { Finding, TextSpan } from '../detection/types';
import { clusterEdits } from '../rewrite/editPlan';
import {
  changesText,
  isDecided,
  type ReviewChoice,
  type ReviewDecision,
} from '../rewrite/reviewDecision';
import { scoreRisk, type RiskAssessment } from '../risk/riskScorer';

/** True when the finding exists and an EDITED choice carries its replacement. */
export function isDecisionValid(
  findings: readonly Finding[],
  findingId: string,
  choice: ReviewChoice,
): boolean {
  const known = findings.some((f) => f.id === findingId);
  return known && (choice.action !== 'EDITED' || choice.replacement !== undefined);
}

/** Spans the rewrite will replace: ACCEPTED/EDITED spans merged exactly as the applier does. */
export function changedSpans(
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): TextSpan[] {
  const byId = new Map(findings.map((f) => [f.id, f]));
  const edits = decisions.flatMap((decision) => {
    const finding = byId.get(decision.findingId);
    if (!finding || !changesText(decision)) return [];
    return [{ findingId: finding.id, span: finding.span, replacement: '', typed: false }];
  });
  return clusterEdits(edits).map((cluster) => cluster.span);
}

/**
 * Findings that still count toward the residual risk: pending (no decision, or the
 * PENDING_BY_USER marker) or KEPT_RISK, and still in the text. A finding fully inside a
 * merged ACCEPTED/EDITED span disappears with it, whatever its own decision. NOT_ABOUT_ME findings never count: the reporter
 * says the model misjudged them. Unknown decision ids are ignored here.
 */
export function remainingFindings(
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): Finding[] {
  const byId = new Map(decisions.map((d) => [d.findingId, d]));
  const spans = changedSpans(findings, decisions);
  return findings.filter((finding) => {
    const decision = byId.get(finding.id);
    const counts = !isDecided(decision) || decision?.action === 'KEPT_RISK';
    return counts && !spans.some((span) => spanContains(span, finding.span));
  });
}

/** Residual risk = scoreRisk(pending + KEPT_RISK findings); shown live during review. */
export function remainingRisk(
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): RiskAssessment {
  return scoreRisk(remainingFindings(findings, decisions));
}
