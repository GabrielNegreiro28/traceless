import { describe, expect, it } from 'vitest';
import { MODEL_FINDING_CATEGORIES } from '../schemas/identityScan';
import { STRATEGIES as V1_STRATEGIES } from './identityScan.v1';
import { STRATEGIES } from './strategies';

describe('STRATEGIES', () => {
  it('keeps every v1 strategy unchanged', () => {
    expect(STRATEGIES.single).toBe(V1_STRATEGIES.single);
    expect(STRATEGIES.grouped2).toBe(V1_STRATEGIES.grouped2);
  });

  it('adds single2: the full category list twice (design §C.3)', () => {
    expect(STRATEGIES.single2).toEqual([MODEL_FINDING_CATEGORIES, MODEL_FINDING_CATEGORIES]);
    expect(Object.keys(STRATEGIES)).toEqual(['single', 'grouped2', 'single2']);
  });
});
