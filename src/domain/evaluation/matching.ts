import { spanLength } from '../detection/span';
import type { TextSpan } from '../detection/types';

export const MATCH_THRESHOLD = 0.5;

/** `|a ∩ b| / min(|a|, |b|)`; 0 when either span is empty. */
export function overlapRatio(a: TextSpan, b: TextSpan): number {
  const shared = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  const shorter = Math.min(spanLength(a), spanLength(b));
  if (shared <= 0 || shorter <= 0) return 0;
  return shared / shorter;
}

/** Two spans refer to the same detail when their overlap ratio reaches 0.5. */
export function spansMatch(a: TextSpan, b: TextSpan): boolean {
  return overlapRatio(a, b) >= MATCH_THRESHOLD;
}
