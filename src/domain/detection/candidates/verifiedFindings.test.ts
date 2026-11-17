import { describe, expect, it } from 'vitest';
import type { Candidate } from './candidateTypes';
import { verifiedFindings, verifiedTemplate, type CandidateVerdict } from './verifiedFindings';

const TEXT = 'I mop the atrium at dawn. Our caretaker hides the fuel cards.';

function candidate(quote: string): Candidate {
  const start = TEXT.indexOf(quote);
  return { span: { start, end: start + quote.length }, quote };
}

const CANDIDATES = [
  candidate('I mop the atrium'),
  candidate('at dawn'),
  candidate('hides the fuel cards'),
];

describe('verifiedFindings', () => {
  it('keeps WRITER verdicts with a category, at the exact candidate span', () => {
    const verdicts: CandidateVerdict[] = [
      { index: 0, about: 'WRITER', category: 'ROLE_UNIQUE' },
      { index: 1, about: 'WRITER', category: 'SCHEDULE' },
    ];
    expect(verifiedFindings(CANDIDATES, verdicts)).toEqual([
      {
        id: 'model:0-16:ROLE_UNIQUE',
        span: { start: 0, end: 16 },
        quote: 'I mop the atrium',
        category: 'ROLE_UNIQUE',
        reason: verifiedTemplate('ROLE_UNIQUE').reason,
        suggestion: 'a member of the team',
        origin: 'MODEL',
      },
      expect.objectContaining({ quote: 'at dawn', category: 'SCHEDULE', origin: 'MODEL' }),
    ]);
  });

  it('drops OTHER, UNSURE and NONE verdicts', () => {
    const verdicts: CandidateVerdict[] = [
      { index: 0, about: 'WRITER', category: 'NONE' },
      { index: 1, about: 'UNSURE', category: 'SCHEDULE' },
      { index: 2, about: 'OTHER', category: 'ROLE_UNIQUE' },
    ];
    expect(verifiedFindings(CANDIDATES, verdicts)).toEqual([]);
  });

  it('ignores unknown indexes and keeps the first verdict of a repeated index', () => {
    const verdicts: CandidateVerdict[] = [
      { index: 7, about: 'WRITER', category: 'LOCATION' },
      { index: 1, about: 'OTHER', category: 'NONE' },
      { index: 1, about: 'WRITER', category: 'SCHEDULE' },
    ];
    expect(verifiedFindings(CANDIDATES, verdicts)).toEqual([]);
  });

  it('removes direct identifiers and traits by default (null suggestion)', () => {
    expect(verifiedTemplate('DIRECT_IDENTIFIER').suggestion).toBeNull();
    expect(verifiedTemplate('PERSONAL_TRAIT').suggestion).toBeNull();
  });
});
