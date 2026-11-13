import { describe, expect, it } from 'vitest';
import { getPromptModule } from '../../ai/prompts/promptRegistry';
import { STRATEGIES } from '../../ai/prompts/strategies';
import { POST_FILTERS } from '../../domain/detection/postFilters';
import { EVAL_VARIANTS, findVariant } from './evalVariants';

describe('EVAL_VARIANTS', () => {
  it('has unique file-name-safe ids, registered prompts, strategies and filters', () => {
    const ids = EVAL_VARIANTS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const variant of EVAL_VARIANTS) {
      expect(variant.id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
      expect(getPromptModule(variant.promptVersion)).toBeDefined();
      expect(STRATEGIES[variant.strategy]).toBeDefined();
      for (const filter of variant.postFilters) expect(POST_FILTERS).toContain(filter);
    }
  });

  it('starts with the v1 single baseline', () => {
    expect(EVAL_VARIANTS[0]).toMatchObject({
      id: 'v1-single',
      promptVersion: 'identityScan.v1',
      strategy: 'single',
      chunkChars: 3000,
      postFilters: [],
    });
    expect(findVariant('v1-single')).toBe(EVAL_VARIANTS[0]);
    expect(findVariant('nope')).toBeUndefined();
  });

  it('registers the dev matrix M0-M3, every v2 variant with both post-filters', () => {
    expect(EVAL_VARIANTS.map((v) => [v.id, v.promptVersion, v.strategy])).toEqual([
      ['v1-single', 'identityScan.v1', 'single'],
      ['v2-single', 'identityScan.v2', 'single'],
      ['v2-grouped2', 'identityScan.v2', 'grouped2'],
      ['v2-single2', 'identityScan.v2', 'single2'],
    ]);
    for (const variant of EVAL_VARIANTS.slice(1)) {
      expect(variant.postFilters).toEqual(['protectedMentions', 'thirdPerson']);
      expect(variant.chunkChars).toBe(3000);
    }
  });
});
