import { spanLength } from '../detection/span';
import { FINDING_CATEGORIES, type FindingCategory, type TextSpan } from '../detection/types';
import type { CategoryTally, EvalFinding } from './evalTypes';
import { MATCH_THRESHOLD, overlapRatio, spansMatch } from './matching';
import type { ResolvedGold } from './resolveSpans';

export const OVERSIZED_FACTOR = 2;
export const OVERSIZED_SLACK_CHARS = 30;
export const OVERSIZED_MAX_CHARS = 120;

export function emptyPerCategory(): Record<FindingCategory, { total: number; hit: number }> {
  return Object.fromEntries(FINDING_CATEGORIES.map((c) => [c, { total: 0, hit: 0 }])) as Record<
    FindingCategory,
    { total: number; hit: number }
  >;
}

/** Longest finding still considered precise for a gold of this length. */
function maxPreciseLength(goldLength: number): number {
  return Math.max(OVERSIZED_FACTOR * goldLength, goldLength + OVERSIZED_SLACK_CHARS);
}

/** Matches the gold and is neither over 120 chars nor too long for that gold. */
function fitsGold(finding: EvalFinding, gold: ResolvedGold): boolean {
  const length = spanLength(finding.span);
  return (
    spansMatch(finding.span, gold.span) &&
    length <= OVERSIZED_MAX_CHARS &&
    length <= maxPreciseLength(spanLength(gold.span))
  );
}

/** The matching item with the largest overlap ratio (first wins ties). */
function bestMatch<T>(
  items: readonly T[],
  span: (item: T) => TextSpan,
  target: TextSpan,
): T | null {
  let best: T | null = null;
  let bestRatio = 0;
  for (const item of items) {
    const ratio = overlapRatio(span(item), target);
    if (ratio >= MATCH_THRESHOLD && ratio > bestRatio) {
      best = item;
      bestRatio = ratio;
    }
  }
  return best;
}

/** Fraction of the gold's characters covered by the union of all findings. */
export function goldCoverage(gold: ResolvedGold, findings: readonly EvalFinding[]): number {
  const clipped: TextSpan[] = findings
    .map((f) => ({
      start: Math.max(f.span.start, gold.span.start),
      end: Math.min(f.span.end, gold.span.end),
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  let covered = 0;
  let reach = gold.span.start;
  for (const s of clipped) {
    const from = Math.max(s.start, reach);
    if (s.end > from) covered += s.end - from;
    reach = Math.max(reach, s.end);
  }
  return covered / spanLength(gold.span);
}

export interface GoldTallies {
  readonly perCategory: CategoryTally;
  readonly goldHit: number;
  readonly strictHit: number;
  readonly ruleMissed: number;
  readonly modelRecovered: number;
  readonly categoryCorrect: number;
  readonly coverageSum: number;
}

/** Gold-side tallies. Hits use merged findings; origin attribution uses the pre-merge lists. */
export function goldTallies(
  gold: readonly ResolvedGold[],
  findings: readonly EvalFinding[],
  ruleFindings: readonly EvalFinding[],
  modelFindings: readonly EvalFinding[],
): GoldTallies {
  const perCategory = emptyPerCategory();
  const t = { goldHit: 0, strictHit: 0, ruleMissed: 0, modelRecovered: 0, categoryCorrect: 0 };
  let coverageSum = 0;
  for (const g of gold) {
    const bucket = perCategory[g.category];
    bucket.total += 1;
    const best = bestMatch(findings, (f) => f.span, g.span);
    if (best !== null) {
      t.goldHit += 1;
      bucket.hit += 1;
      coverageSum += goldCoverage(g, findings);
      if (best.category === g.category) t.categoryCorrect += 1;
      if (findings.some((f) => fitsGold(f, g))) t.strictHit += 1;
    }
    if (!ruleFindings.some((f) => spansMatch(f.span, g.span))) {
      t.ruleMissed += 1;
      if (modelFindings.some((f) => spansMatch(f.span, g.span))) t.modelRecovered += 1;
    }
  }
  return { perCategory, coverageSum, ...t };
}

/** Over 120 chars, or too long for the gold it best matches. */
function isOversized(finding: EvalFinding, gold: readonly ResolvedGold[]): boolean {
  const length = spanLength(finding.span);
  if (length > OVERSIZED_MAX_CHARS) return true;
  const best = bestMatch(gold, (g) => g.span, finding.span);
  return best !== null && length > maxPreciseLength(spanLength(best.span));
}

export function findingTallies(findings: readonly EvalFinding[], gold: readonly ResolvedGold[]) {
  return {
    findingsCorrect: findings.filter((f) => gold.some((g) => fitsGold(f, g))).length,
    oversized: findings.filter((f) => isOversized(f, gold)).length,
  };
}
