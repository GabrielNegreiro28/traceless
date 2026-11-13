import { describe, expect, it } from 'vitest';
import { toRawText } from '../text/brandedText';
import { applyPostFilters, POST_FILTERS } from './postFilters';
import type { Finding } from './types';

const TEXT = toRawText(
  'Our pastry chef, Marisol Teague, sells the flour. Teague takes it home. ' +
    'He also burns the logs. I am the only baker on Mondays.',
);

function at(quote: string): Finding {
  const start = TEXT.indexOf(quote);
  if (start < 0) throw new Error(`fixture quote not found: ${quote}`);
  return {
    id: `MODEL:${start}`,
    span: { start, end: start + quote.length },
    quote,
    category: 'ROLE_UNIQUE',
    reason: 'r',
    suggestion: null,
    origin: 'MODEL',
  };
}

const FINDINGS = [
  at('Our pastry chef, Marisol Teague'),
  at('Teague takes it home'),
  at('He also burns the logs'),
  at('I am the only baker on Mondays'),
];
const QUOTES = ['Our pastry chef, Marisol Teague'];

describe('applyPostFilters', () => {
  it('runs protectedMentions, then thirdPerson', () => {
    expect(POST_FILTERS).toEqual(['protectedMentions', 'thirdPerson']);
  });

  it('is the identity with no filters enabled', () => {
    expect(applyPostFilters(TEXT, FINDINGS, QUOTES, [])).toEqual({
      kept: FINDINGS,
      suppressed: 0,
      protectedSpans: [],
    });
  });

  it('applies only the enabled filters', () => {
    const thirdOnly = applyPostFilters(TEXT, FINDINGS, QUOTES, ['thirdPerson']);
    expect(thirdOnly.kept).toEqual([FINDINGS[0], FINDINGS[1], FINDINGS[3]]);
    expect(thirdOnly.protectedSpans).toEqual([]);
    const protectedOnly = applyPostFilters(TEXT, FINDINGS, QUOTES, ['protectedMentions']);
    expect(protectedOnly.kept).toEqual([FINDINGS[2], FINDINGS[3]]);
    expect(protectedOnly.protectedSpans).toHaveLength(2);
  });

  it('counts every suppressed finding once with both filters', () => {
    const both = applyPostFilters(TEXT, FINDINGS, QUOTES, ['protectedMentions', 'thirdPerson']);
    expect(both.kept).toEqual([FINDINGS[3]]);
    expect(both.suppressed).toBe(3);
  });
});
