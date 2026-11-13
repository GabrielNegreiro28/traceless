import { spanContains } from './span';
import type { Finding } from './types';

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Total order on competing findings (negative = `a` is better): RULE origin first,
 * then the longer (more specific) reason, then reason text, then id. Being total, the
 * winner never depends on input order.
 */
function compareQuality(a: Finding, b: Finding): number {
  if (a.origin !== b.origin) return a.origin === 'RULE' ? -1 : 1;
  return (
    b.reason.length - a.reason.length || compareText(a.reason, b.reason) || compareText(a.id, b.id)
  );
}

function dedupeBySpanAndCategory(findings: readonly Finding[]): Finding[] {
  const best = new Map<string, Finding>();
  for (const finding of findings) {
    const key = `${finding.span.start}-${finding.span.end}:${finding.category}`;
    const existing = best.get(key);
    if (!existing || compareQuality(finding, existing) < 0) best.set(key, finding);
  }
  return [...best.values()];
}

function isSwallowed(finding: Finding, all: readonly Finding[]): boolean {
  return all.some(
    (other) =>
      other !== finding &&
      other.category === finding.category &&
      (other.span.start !== finding.span.start || other.span.end !== finding.span.end) &&
      spanContains(other.span, finding.span),
  );
}

function compareOrder(a: Finding, b: Finding): number {
  return (
    a.span.start - b.span.start ||
    a.span.end - b.span.end ||
    compareText(a.category, b.category) ||
    compareText(a.id, b.id)
  );
}

/**
 * Merges rule and model findings into one ordered list.
 *
 * Policy:
 * 1. Findings with the same span AND category collapse to one: RULE origin wins over
 *    MODEL, then the longer reason, then reason text, then id (a total order, so the
 *    result is independent of input order). Same span with different categories are
 *    kept as separate findings.
 * 2. A finding strictly contained in a larger finding of the SAME category is dropped.
 * 3. Containment across different categories and partial overlaps (any category) keep
 *    both findings, because each is a distinct risk the reporter should review.
 * 4. The result is sorted by start, end, category, then id (deterministic).
 *
 * Note: the output may still contain overlapping spans (rules 3). The future
 * rewriteApplier must handle overlaps explicitly when applying edits.
 */
export function mergeFindings(findings: Finding[]): Finding[] {
  const unique = dedupeBySpanAndCategory(findings);
  return unique.filter((finding) => !isSwallowed(finding, unique)).sort(compareOrder);
}
