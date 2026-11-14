import { describe, expect, it } from 'vitest';
import { EVAL_PRESETS, variantsForPreset, type EvalPreset } from './evalPresets';
import { DEFAULT_EVAL_VARIANT, findVariant } from './evalVariants';

function preset(id: EvalPreset['id']): EvalPreset {
  const found = EVAL_PRESETS.find((p) => p.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return found;
}

describe('evaluation presets', () => {
  it('Round 2 runs dev x 3 for exactly the two round-2 variants (§G.4)', () => {
    const round2 = preset('round2');
    expect(round2).toMatchObject({ split: 'dev', runs: 3, reportLimit: null });
    expect(round2.label).toBe(
      '5. Round 2: dev x 3 runs, 2 variants only (v2-single2-rules + v2-single3-rules)',
    );
    const variants = variantsForPreset(round2, DEFAULT_EVAL_VARIANT);
    expect(variants.ok && variants.value.map((v) => v.id)).toEqual([
      'v2-single2-rules',
      'v2-single3-rules',
    ]);
  });

  it('pins the Dev matrix to the four round-1 variants and the others on the selection', () => {
    const matrix = variantsForPreset(preset('devMatrix'), DEFAULT_EVAL_VARIANT);
    expect(matrix.ok && matrix.value.map((v) => v.id)).toEqual([
      'v1-single',
      'v2-single',
      'v2-grouped2',
      'v2-single2',
    ]);
    expect(preset('devMatrix').label).toBe('4. Dev matrix: 4 round-1 variants x dev x 3 runs');
    const selected = findVariant('v2-single2')!;
    for (const id of ['smoke', 'dev', 'dev3', 'full'] as const) {
      expect(variantsForPreset(preset(id), selected)).toEqual({ ok: true, value: [selected] });
    }
  });

  it('refuses a preset that names an unregistered variant', () => {
    const broken: EvalPreset = { ...preset('round2'), variants: ['v2-single2-rules', 'nope'] };
    const result = variantsForPreset(broken, DEFAULT_EVAL_VARIANT);
    expect(!result.ok && result.error).toMatchObject({ kind: 'Misconfigured', missing: ['nope'] });
  });

  it('numbers the presets in click order with unique ids', () => {
    expect(EVAL_PRESETS.map((p) => p.label.split('.')[0])).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(new Set(EVAL_PRESETS.map((p) => p.id)).size).toBe(EVAL_PRESETS.length);
  });
});
