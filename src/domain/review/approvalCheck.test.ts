import { describe, expect, it } from 'vitest';
import type { RiskLevel } from '../risk/riskScorer';
import { isAcknowledgementRequired } from './approvalCheck';

describe('isAcknowledgementRequired', () => {
  const cases: readonly (readonly [RiskLevel, number, boolean])[] = [
    ['NONE', 0, false],
    ['LOW', 0, false],
    ['MEDIUM', 0, true],
    ['HIGH', 0, true],
    ['NONE', 1, true],
    ['LOW', 2, true],
  ];

  it.each(cases)('level %s with %i kept direct identifiers -> %s', (level, kept, required) => {
    expect(isAcknowledgementRequired(level, kept)).toBe(required);
  });
});
