import { describe, expect, it } from 'vitest';
import { FINDING_CATEGORIES, type Finding, type FindingCategory } from '../detection/types';
import { CATEGORY_WEIGHTS, scoreRisk } from './riskScorer';

function finding(category: FindingCategory, n = 0): Finding {
  return {
    id: `${category}-${n}`,
    span: { start: n, end: n + 1 },
    quote: 'x',
    category,
    reason: 'r',
    suggestion: null,
    origin: 'RULE',
  };
}

function many(category: FindingCategory, n: number): Finding[] {
  return Array.from({ length: n }, (_, i) => finding(category, i));
}

describe('scoreRisk', () => {
  it('returns NONE for no findings', () => {
    expect(scoreRisk([])).toMatchObject({ level: 'NONE', score: 0, categories: [], drivers: [] });
  });

  it('rates a single writing-style detail LOW', () => {
    const r = scoreRisk([finding('WRITING_STYLE')]);
    expect(r.level).toBe('LOW');
    expect(r.score).toBeCloseTo(0.15);
    expect(r.explanation).toBe('1 identifying detail: writing style');
  });

  it('rates role + schedule + location HIGH (about 0.83)', () => {
    const r = scoreRisk([finding('ROLE_UNIQUE'), finding('SCHEDULE'), finding('LOCATION')]);
    expect(r.level).toBe('HIGH');
    expect(r.score).toBeCloseTo(1 - 0.4 * 0.65 * 0.65);
    expect(r.explanation).toBe('3 identifying details combined: unique role + schedule + location');
  });

  it('is super-additive compared to the strongest single detail', () => {
    const r = scoreRisk([finding('SCHEDULE'), finding('LOCATION')]);
    expect(r.score).toBeGreaterThan(CATEGORY_WEIGHTS.SCHEDULE);
    expect(r.level).toBe('MEDIUM');
    expect(r.explanation).toBe('2 identifying details combined: schedule + location');
  });

  it('rates any direct identifier HIGH', () => {
    expect(scoreRisk([finding('DIRECT_IDENTIFIER')]).level).toBe('HIGH');
    expect(scoreRisk([finding('DIRECT_IDENTIFIER'), finding('WRITING_STYLE')]).level).toBe('HIGH');
  });

  it('does not depend on finding order', () => {
    const a = [finding('LOCATION', 1), finding('ROLE_UNIQUE', 2), finding('LOCATION', 3)];
    expect(scoreRisk([...a].reverse())).toEqual(scoreRisk(a));
  });

  it('sorts categories in FINDING_CATEGORIES order and keeps them distinct', () => {
    const r = scoreRisk([...many('WRITING_STYLE', 1), ...many('ROLE_UNIQUE', 2)]);
    expect(r.categories).toEqual(['ROLE_UNIQUE', 'WRITING_STYLE']);
  });

  it('bounds the bonus for repeats at two extras', () => {
    const three = scoreRisk(many('LOCATION', 3)).score;
    expect(scoreRisk(many('LOCATION', 2)).score).toBeGreaterThan(
      scoreRisk(many('LOCATION', 1)).score,
    );
    expect(three).toBeGreaterThan(scoreRisk(many('LOCATION', 2)).score);
    expect(scoreRisk(many('LOCATION', 50)).score).toBeCloseTo(three);
    expect(three).toBeCloseTo(CATEGORY_WEIGHTS.LOCATION * 1.2);
  });

  it('keeps the score within [0, 1] for every category combination', () => {
    const all = FINDING_CATEGORIES.flatMap((c) => many(c, 3));
    for (const set of [all, FINDING_CATEGORIES.map((c) => finding(c))]) {
      const { score } = scoreRisk(set);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('includes counts in the explanation', () => {
    expect(scoreRisk(many('LOCATION', 3)).explanation).toBe('3 identifying details: location ×3');
    const r = scoreRisk([...many('ROLE_UNIQUE', 1), ...many('SCHEDULE', 2)]);
    expect(r.explanation).toBe('3 identifying details combined: unique role + schedule ×2');
  });

  it('lists drivers per category with counts', () => {
    const r = scoreRisk(many('SCHEDULE', 2));
    expect(r.drivers).toHaveLength(1);
    expect(r.drivers[0]).toMatchObject({ category: 'SCHEDULE', count: 2 });
    expect(r.drivers[0]?.weight).toBeCloseTo(0.385);
  });
});
