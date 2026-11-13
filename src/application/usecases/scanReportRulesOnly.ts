import { mergeFindings } from '../../domain/detection/findingMerger';
import { detectByRules } from '../../domain/detection/ruleDetector';
import type { Finding } from '../../domain/detection/types';
import type { RawText } from '../../domain/text/brandedText';

export interface RulesOnlyScanResult {
  /** Deterministic pattern-rule findings only (origin RULE): no model read the text. */
  readonly findings: Finding[];
}

/**
 * "Continue with basic checks" (docs/design/fase2-gate-iteration.md §G.2): when the on-device
 * AI stalled for good, the reporter can still review the findings of the pattern rules
 * (direct identifiers, explicit dates, sign-offs) over the full text. Pure and local: it
 * takes no scanner and calls no model. The review must say that the AI checks did not run.
 */
export function scanReportRulesOnly(text: RawText): RulesOnlyScanResult {
  return { findings: mergeFindings(detectByRules(text)) };
}
