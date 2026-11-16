import { describe, expect, it } from 'vitest';
import { getPromptModule } from '../../ai/prompts/promptRegistry';
import { SHIPPED_SCAN_PIPELINE } from '../../ai/prompts/scanPipelines';
import { STRATEGIES } from '../../ai/prompts/strategies';
import { POST_FILTERS } from '../../domain/detection/postFilters';
import { EVAL_VARIANTS, findVariant, ROUND2_VARIANT_IDS } from './evalVariants';

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

  it('registers M0-M3 and the round-2 pair, every v2 variant with both post-filters', () => {
    expect(EVAL_VARIANTS.map((v) => [v.id, v.promptVersion, v.strategy, v.rulePack])).toEqual([
      ['v1-single', 'identityScan.v1', 'single', 'core'],
      ['v2-single', 'identityScan.v2', 'single', 'core'],
      ['v2-grouped2', 'identityScan.v2', 'grouped2', 'core'],
      ['v2-single2', 'identityScan.v2', 'single2', 'core'],
      ['v2-single2-rules', 'identityScan.v2', 'single2', 'core+firstPerson'],
      ['v2-single3-rules', 'identityScan.v2', 'single3', 'core+firstPerson'],
    ]);
    for (const variant of EVAL_VARIANTS.slice(1)) {
      expect(variant.postFilters).toEqual(['protectedMentions', 'thirdPerson']);
      expect(variant.chunkChars).toBe(3000);
    }
  });

  it('the round-2 variants differ from v2-single2 only in strategy and rule pack (§G.4)', () => {
    const base = findVariant('v2-single2');
    expect(ROUND2_VARIANT_IDS).toEqual(['v2-single2-rules', 'v2-single3-rules']);
    for (const id of ROUND2_VARIANT_IDS) {
      expect(findVariant(id)).toEqual({
        promptVersion: base?.promptVersion,
        chunkChars: base?.chunkChars,
        postFilters: base?.postFilters,
        id,
        strategy: id === 'v2-single2-rules' ? 'single2' : 'single3',
        rulePack: 'core+firstPerson',
      });
    }
  });

  it('v2-single2-rules is exactly the shipped pipeline (§G.5)', () => {
    const { id, ...spec } = findVariant('v2-single2-rules') ?? { id: 'missing' };
    expect(id).toBe('v2-single2-rules');
    expect(spec).toEqual(SHIPPED_SCAN_PIPELINE);
  });
});
