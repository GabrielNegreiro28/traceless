import type { FindingCategory, FindingOrigin, TextSpan } from './types';

export function spanLength(span: TextSpan): number {
  return span.end - span.start;
}

/** True when the two spans share at least one character. */
export function spansOverlap(a: TextSpan, b: TextSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True when `outer` fully covers `inner` (equal spans contain each other). */
export function spanContains(outer: TextSpan, inner: TextSpan): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

export function shiftSpan(span: TextSpan, offset: number): TextSpan {
  return { start: span.start + offset, end: span.end + offset };
}

/** Deterministic finding id; rule ids omit the category (rules own their span). */
export function buildFindingId(
  origin: FindingOrigin,
  span: TextSpan,
  category: FindingCategory,
): string {
  const base = `${span.start}-${span.end}`;
  return origin === 'RULE' ? `rule:${base}` : `model:${base}:${category}`;
}
