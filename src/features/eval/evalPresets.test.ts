import { describe, expect, it } from 'vitest';
import { evaluateDetection } from '../../application/usecases/evaluateDetection';
import { loadEvalDataset } from '../../test/evalDataset';
import {
  datasetForPreset,
  EVAL_PRESETS,
  presetDataset,
  variantsForPreset,
  type EvalPreset,
} from './evalPresets';
import { EMPTY_SCAN, TEST_DATASET } from './evalTestKit';
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
      expect(preset(id).dataset).toBe('v1');
      expect(variantsForPreset(preset(id), selected)).toEqual({ ok: true, value: [selected] });
    }
  });

  it('refuses a preset that names an unregistered variant', () => {
    const broken: EvalPreset = { ...preset('round2'), variants: ['v2-single2-rules', 'nope'] };
    const result = variantsForPreset(broken, DEFAULT_EVAL_VARIANT);
    expect(!result.ok && result.error).toMatchObject({ kind: 'Misconfigured', missing: ['nope'] });
  });

  it('numbers the presets in click order with unique ids', () => {
    expect(EVAL_PRESETS.map((p) => p.label.split('.')[0])).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
    expect(new Set(EVAL_PRESETS.map((p) => p.id)).size).toBe(EVAL_PRESETS.length);
  });

  it('Round 3 runs the three cascades + baseline x 3 over all 24 v1 reports, no gate', async () => {
    const round3 = preset('round3');
    expect(round3).toMatchObject({ dataset: 'v1', split: 'all', runs: 3, reportLimit: null });
    expect(round3.label).toBe('7. Round 3: dev pool (all 24 v1 reports) x 3 runs, 4 variants');
    const variants = variantsForPreset(round3, findVariant('v2-single')!);
    expect(variants.ok && variants.value.map((v) => v.id)).toEqual([
      'v3-base+investigator',
      'v3-verifier+investigator',
      'v3-base+verifier+investigator',
      'v2-single2-rules',
    ]);
    const v1 = loadEvalDataset();
    const dataset = presetDataset({ v1 }, round3);
    if (!dataset.ok) throw new Error('no dataset');
    const result = await evaluateDetection({
      dataset: datasetForPreset(dataset.value, round3),
      split: round3.split,
      scan: EMPTY_SCAN,
      clock: { now: () => 0 },
      runs: 1,
      variant: findVariant('v2-single2-rules')!,
    });
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.summary.reports).toBe(24);
    expect(new Set(result.value.runs[0]?.reports.map((r) => r.split))).toEqual(
      new Set(['dev', 'test']),
    );
    expect(result.value.gate).toBeNull();
  });

  it('Final v2 test runs the selected variant + baseline x 3 on the v2 split, with the gate', async () => {
    const final = preset('finalV2');
    expect(final).toMatchObject({ dataset: 'v2test', split: 'test', runs: 3, reportLimit: null });
    const selected = findVariant('v3-verifier+investigator')!;
    const variants = variantsForPreset(final, selected);
    expect(variants.ok && variants.value.map((v) => v.id)).toEqual([
      'v3-verifier+investigator',
      'v2-single2-rules',
    ]);
    const baselineOnly = variantsForPreset(final, findVariant('v2-single2-rules')!);
    expect(baselineOnly.ok && baselineOnly.value.map((v) => v.id)).toEqual(['v2-single2-rules']);
    const v2test = {
      ...TEST_DATASET,
      reports: TEST_DATASET.reports.map((r) => ({ ...r, split: 'test' as const })),
    };
    const missing = presetDataset({ v1: loadEvalDataset() }, final);
    expect(!missing.ok && missing.error).toMatchObject({
      kind: 'Misconfigured',
      missing: ['v2test'],
    });
    const chosen = presetDataset({ v1: loadEvalDataset(), v2test }, final);
    expect(chosen.ok && chosen.value).toBe(v2test);
    const result = await evaluateDetection({
      dataset: v2test,
      split: final.split,
      scan: EMPTY_SCAN,
      clock: { now: () => 0 },
      runs: 1,
      variant: selected,
    });
    expect(result.ok && result.value.gate).not.toBeNull();
  });
});
