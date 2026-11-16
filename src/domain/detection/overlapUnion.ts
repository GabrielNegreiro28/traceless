import { buildFindingId, spanContains, spanLength, spansOverlap } from './span';
import type { Finding } from './types';

/**
 * Partial overlaps of the SAME category merge into one finding over the union of their spans
 * (pure). Without this the reporter sees two cards for one detail (the rule's "work Tuesday"
 * and the model's "Tuesday to Saturday, from 10 p.m. to 6 a.m"), and accepting both rewrites
 * overlapping text.
 */

/** Total order of the finding that lends its id and reason to a union (RULE first). */
export type FindingQuality = (a: Finding, b: Finding) => number;

/** A quote that is not exactly its span's text cannot be stitched safely. */
function hasExactQuote(finding: Finding): boolean {
  return finding.quote.length === spanLength(finding.span);
}

/** The union quote of two overlapping findings, `left` starting first. */
function stitchQuote(left: Finding, right: Finding): string {
  if (spanContains(left.span, right.span)) return left.quote;
  return left.quote + right.quote.slice(left.span.end - right.span.start);
}

function hasSuggestion(finding: Finding): boolean {
  return finding.suggestion !== null && finding.suggestion.trim() !== '';
}

/**
 * One finding for a chain of overlapping same-category findings: the best member's reason, a
 * fresh id for the union span, origin RULE if any member is a RULE, the union span and quote. The suggestion of a
 * MODEL member is used only when that member covers the whole union; otherwise the best
 * member's (the RULE's when there is one), since a narrower suggestion would drop text.
 */
function unite(group: readonly Finding[], quality: FindingQuality): Finding {
  const [best] = [...group].sort(quality);
  let merged = group[0]!;
  for (const next of group.slice(1)) {
    const span = { start: merged.span.start, end: Math.max(merged.span.end, next.span.end) };
    merged = { ...merged, span, quote: stitchQuote(merged, next) };
  }
  const covering = group.find(
    (f) => f.origin === 'MODEL' && hasSuggestion(f) && spanContains(f.span, merged.span),
  );
  const origin = group.some((f) => f.origin === 'RULE') ? 'RULE' : best!.origin;
  const suggestion = (covering ?? best!).suggestion;
  const id = buildFindingId(origin, merged.span, best!.category);
  return { ...best!, id, span: merged.span, quote: merged.quote, origin, suggestion };
}

/** Sweeps one category by start and chains findings that share at least one character. */
function chainOverlaps(findings: readonly Finding[]): Finding[][] {
  const sorted = [...findings].sort(
    (a, b) => a.span.start - b.span.start || b.span.end - a.span.end,
  );
  const chains: Finding[][] = [];
  for (const finding of sorted) {
    const chain = chains.at(-1);
    const end = chain === undefined ? -1 : Math.max(...chain.map((f) => f.span.end));
    if (chain !== undefined && spansOverlap({ start: chain[0]!.span.start, end }, finding.span)) {
      chain.push(finding);
    } else chains.push([finding]);
  }
  return chains;
}

/** Merges same-category partial overlaps; findings with an inexact quote are left as they are. */
export function uniteOverlaps(findings: readonly Finding[], quality: FindingQuality): Finding[] {
  const exact = findings.filter(hasExactQuote);
  const byCategory = new Map<string, Finding[]>();
  for (const finding of exact) {
    byCategory.set(finding.category, [...(byCategory.get(finding.category) ?? []), finding]);
  }
  const united = [...byCategory.values()].flatMap((group) =>
    chainOverlaps(group).map((chain) => (chain.length === 1 ? chain[0]! : unite(chain, quality))),
  );
  return [...united, ...findings.filter((f) => !hasExactQuote(f))];
}
