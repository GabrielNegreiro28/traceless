import { uniteOverlaps } from './overlapUnion';
import { spanContains } from './span';
import type { Finding, TextSpan } from './types';

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

function hasSuggestion(finding: Finding): boolean {
  return finding.suggestion !== null && finding.suggestion.trim() !== '';
}

/**
 * One finding for a group with the same span and category: the best by compareQuality. A
 * RULE winner takes the suggestion of the best MODEL finding that has a non-empty one: the
 * model wrote it for exactly this text, and it fits the context better than a generic one.
 */
function resolveDuplicates(group: readonly Finding[]): Finding {
  const [best, ...rest] = [...group].sort(compareQuality);
  if (best === undefined) throw new Error('resolveDuplicates needs a non-empty group');
  const model =
    best.origin === 'RULE' ? rest.find((f) => f.origin === 'MODEL' && hasSuggestion(f)) : undefined;
  return model === undefined ? best : { ...best, suggestion: model.suggestion };
}

function dedupeBySpanAndCategory(findings: readonly Finding[]): Finding[] {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = `${finding.span.start}-${finding.span.end}:${finding.category}`;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [finding]);
    else group.push(finding);
  }
  return [...groups.values()].map(resolveDuplicates);
}

function strictlyContains(outer: TextSpan, inner: TextSpan): boolean {
  return (outer.start !== inner.start || outer.end !== inner.end) && spanContains(outer, inner);
}

function isSwallowed(finding: Finding, all: readonly Finding[]): boolean {
  return all.some(
    (other) =>
      other !== finding &&
      other.category === finding.category &&
      strictlyContains(other.span, finding.span),
  );
}

/**
 * A MODEL finding that swallowed a RULE finding of its category becomes origin RULE. It keeps
 * its span, quote, reason, suggestion (written for this wider span) and its unique id.
 */
function keepRuleOrigin(survivor: Finding, all: readonly Finding[]): Finding {
  if (survivor.origin === 'RULE') return survivor;
  const swallowsRule = all.some(
    (other) =>
      other.origin === 'RULE' &&
      other.category === survivor.category &&
      strictlyContains(survivor.span, other.span),
  );
  return swallowsRule ? { ...survivor, origin: 'RULE' } : survivor;
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
 * 3. When a RULE and a MODEL finding collapse (rules 1-2), the result keeps origin RULE and
 *    prefers the model's non-empty suggestion (docs/design/fase2-gate-iteration.md §G.3).
 *    The suggestion only moves when it was written for the surviving span: the same span
 *    (rule 1), or a wider MODEL finding that swallowed the RULE one (it keeps its own
 *    suggestion and becomes origin RULE). A RULE finding that swallows a narrower MODEL one
 *    keeps its own suggestion: the model's would replace only part of the RULE's text.
 * 4. Partial overlaps of the SAME category merge into one finding over the union of their
 *    spans (overlapUnion.ts): origin RULE if either is a RULE, the best finding's id and
 *    reason, and a MODEL suggestion only when that finding covers the whole union.
 * 5. Containment and partial overlaps across different categories keep both findings,
 *    because each is a distinct risk the reporter should review.
 * 6. The result is sorted by start, end, category, then id (deterministic).
 *
 * Note: the output may still contain overlapping spans (rule 5). The rewriteApplier
 * handles overlaps explicitly when applying edits.
 */
export function mergeFindings(findings: Finding[]): Finding[] {
  const unique = dedupeBySpanAndCategory(findings);
  const survivors = unique
    .filter((finding) => !isSwallowed(finding, unique))
    .map((finding) => keepRuleOrigin(finding, unique));
  return uniteOverlaps(survivors, compareQuality).sort(compareOrder);
}
