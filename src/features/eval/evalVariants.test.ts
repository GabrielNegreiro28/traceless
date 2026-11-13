import { describe, expect, it } from 'vitest';
import { getPromptModule } from '../../ai/prompts/promptRegistry';
import { EVAL_VARIANTS, findVariant } from './evalVariants';

describe('EVAL_VARIANTS', () => {
  it('has unique file-name-safe ids and registered prompt versions', () => {
    const ids = EVAL_VARIANTS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const variant of EVAL_VARIANTS) {
      expect(variant.id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
      expect(getPromptModule(variant.promptVersion)).toBeDefined();
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
});
