import type { Finding } from '../detection/types';
import type { ReviewDecision } from './reviewDecision';

/**
 * Test helper: a finding located at the `occurrence`-th match of `quote` in `text`, so
 * test spans always agree with the text. Throws when the quote is absent (test bug).
 */
export function findingOf(
  text: string,
  quote: string,
  overrides: Partial<Finding> = {},
  occurrence = 0,
): Finding {
  let start = -1;
  for (let i = 0; i <= occurrence; i++) start = text.indexOf(quote, start + 1);
  if (start < 0) throw new Error('findingOf: quote not found in text');
  const span = { start, end: start + quote.length };
  return {
    id: `t:${span.start}-${span.end}`,
    span,
    quote,
    category: 'LOCATION',
    reason: 'reason',
    suggestion: '[place]',
    origin: 'MODEL',
    ...overrides,
  };
}

export const accept = (finding: Finding): ReviewDecision => ({
  findingId: finding.id,
  action: 'ACCEPTED',
});

export const edit = (finding: Finding, replacement: string): ReviewDecision => ({
  findingId: finding.id,
  action: 'EDITED',
  replacement,
});

export const keep = (finding: Finding): ReviewDecision => ({
  findingId: finding.id,
  action: 'KEPT_RISK',
});

export const notAboutMe = (finding: Finding): ReviewDecision => ({
  findingId: finding.id,
  action: 'NOT_ABOUT_ME',
});
