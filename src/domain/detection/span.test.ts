import { describe, expect, it } from 'vitest';
import { buildFindingId, shiftSpan, spanContains, spanLength, spansOverlap } from './span';

describe('span helpers', () => {
  it('computes length', () => {
    expect(spanLength({ start: 2, end: 7 })).toBe(5);
  });

  it('detects overlap but not mere adjacency', () => {
    expect(spansOverlap({ start: 0, end: 5 }, { start: 4, end: 8 })).toBe(true);
    expect(spansOverlap({ start: 0, end: 5 }, { start: 5, end: 8 })).toBe(false);
    expect(spansOverlap({ start: 6, end: 9 }, { start: 0, end: 5 })).toBe(false);
  });

  it('detects containment', () => {
    expect(spanContains({ start: 0, end: 10 }, { start: 2, end: 5 })).toBe(true);
    expect(spanContains({ start: 0, end: 10 }, { start: 0, end: 10 })).toBe(true);
    expect(spanContains({ start: 2, end: 5 }, { start: 0, end: 10 })).toBe(false);
    expect(spanContains({ start: 0, end: 5 }, { start: 3, end: 8 })).toBe(false);
  });

  it('shifts a span', () => {
    expect(shiftSpan({ start: 1, end: 3 }, 10)).toEqual({ start: 11, end: 13 });
  });

  it('builds ids per origin', () => {
    const span = { start: 4, end: 9 };
    expect(buildFindingId('RULE', span, 'DIRECT_IDENTIFIER')).toBe('rule:4-9');
    expect(buildFindingId('MODEL', span, 'LOCATION')).toBe('model:4-9:LOCATION');
  });
});
