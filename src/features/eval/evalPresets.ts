import type { EvalSplit } from '../../application/usecases/evaluateDetection';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import {
  BASELINE_VARIANT_ID,
  findVariant,
  MATRIX_VARIANT_IDS,
  ROUND2_VARIANT_IDS,
  ROUND3_VARIANT_IDS,
  type EvalVariant,
} from './evalVariants';

export type PresetId =
  'smoke' | 'dev' | 'dev3' | 'devMatrix' | 'round2' | 'full' | 'round3' | 'finalV2';

/**
 * Which dataset a preset reads: `v1` = reports.v1 (dev + old test, the round-3 dev pool);
 * `v2test` = the held-out reports.v2 test split, run once (DECISIONS 2026-11-17).
 */
export type EvalDatasetId = 'v1' | 'v2test';

/** In a preset's variant list: the variant chosen in the selector. */
export const SELECTED_VARIANT = '@selected';

export interface EvalPreset {
  readonly id: PresetId;
  readonly label: string;
  readonly dataset: EvalDatasetId;
  readonly split: EvalSplit;
  readonly runs: number;
  /** Limits the run to the first N reports of the split (smoke test). */
  readonly reportLimit: number | null;
  /**
   * `selected` runs the chosen variant; a list of ids runs exactly those variants, in that
   * order (SELECTED_VARIANT stands for the chosen one; a repeated variant runs once).
   */
  readonly variants: 'selected' | readonly string[];
}

export const EVAL_PRESETS: readonly EvalPreset[] = [
  {
    id: 'smoke',
    label: '1. Smoke test (1 report)',
    dataset: 'v1',
    split: 'dev',
    runs: 1,
    reportLimit: 1,
    variants: 'selected',
  },
  {
    id: 'dev',
    label: '2. Dev split (8 reports, 1 run)',
    dataset: 'v1',
    split: 'dev',
    runs: 1,
    reportLimit: null,
    variants: 'selected',
  },
  {
    id: 'dev3',
    label: '3. Dev split, 3 runs',
    dataset: 'v1',
    split: 'dev',
    runs: 3,
    reportLimit: null,
    variants: 'selected',
  },
  {
    id: 'devMatrix',
    label: `4. Dev matrix: ${MATRIX_VARIANT_IDS.length} round-1 variants x dev x 3 runs`,
    dataset: 'v1',
    split: 'dev',
    runs: 3,
    reportLimit: null,
    variants: MATRIX_VARIANT_IDS,
  },
  {
    id: 'round2',
    label: `5. Round 2: dev x 3 runs, 2 variants only (${ROUND2_VARIANT_IDS.join(' + ')})`,
    dataset: 'v1',
    split: 'dev',
    runs: 3,
    reportLimit: null,
    variants: ROUND2_VARIANT_IDS,
  },
  {
    id: 'full',
    label: '6. Full evaluation (test split, 3 runs)',
    dataset: 'v1',
    split: 'test',
    runs: 3,
    reportLimit: null,
    variants: 'selected',
  },
  {
    id: 'round3',
    label: `7. Round 3: dev pool (all 24 v1 reports) x 3 runs, ${ROUND3_VARIANT_IDS.length} variants`,
    dataset: 'v1',
    split: 'all',
    runs: 3,
    reportLimit: null,
    variants: ROUND3_VARIANT_IDS,
  },
  {
    id: 'finalV2',
    label: `8. Final v2 test (x 3, once): selected variant + ${BASELINE_VARIANT_ID}`,
    dataset: 'v2test',
    split: 'test',
    runs: 3,
    reportLimit: null,
    variants: [SELECTED_VARIANT, BASELINE_VARIANT_ID],
  },
];

/** The datasets the page can evaluate; the held-out v2 test split may be absent. */
export interface EvalDatasets {
  readonly v1: Dataset;
  readonly v2test?: Dataset;
}

/** The dataset a preset reads; Misconfigured when it is not loaded. */
export function presetDataset(
  datasets: EvalDatasets,
  preset: EvalPreset,
): Result<Dataset, AppError> {
  const dataset = datasets[preset.dataset];
  if (dataset !== undefined) return ok(dataset);
  return err(
    createAppError('Misconfigured', {
      message: 'The dataset of this preset is not loaded.',
      missing: [preset.dataset],
    }),
  );
}

/** The dataset restricted to what the preset evaluates. */
export function datasetForPreset(dataset: Dataset, preset: EvalPreset): Dataset {
  if (preset.reportLimit === null) return dataset;
  const inSplit = dataset.reports.filter((r) => preset.split === 'all' || r.split === preset.split);
  return { ...dataset, reports: inSplit.slice(0, preset.reportLimit) };
}

/** The variants the preset runs, in order; Misconfigured when it names an unregistered id. */
export function variantsForPreset(
  preset: EvalPreset,
  selected: EvalVariant,
): Result<readonly EvalVariant[], AppError> {
  if (preset.variants === 'selected') return ok([selected]);
  const lookUp = (id: string) => (id === SELECTED_VARIANT ? selected : findVariant(id));
  const missing = preset.variants.filter((id) => lookUp(id) === undefined);
  if (missing.length > 0) {
    return err(createAppError('Misconfigured', { message: 'Unknown variant in preset.', missing }));
  }
  const found = preset.variants.flatMap((id) => lookUp(id) ?? []);
  return ok(found.filter((v, i) => found.findIndex((other) => other.id === v.id) === i));
}
