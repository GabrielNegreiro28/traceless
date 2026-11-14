import type { EvalSplit } from '../../application/usecases/evaluateDetection';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import {
  findVariant,
  MATRIX_VARIANT_IDS,
  ROUND2_VARIANT_IDS,
  type EvalVariant,
} from './evalVariants';

export type PresetId = 'smoke' | 'dev' | 'dev3' | 'devMatrix' | 'round2' | 'full';

export interface EvalPreset {
  readonly id: PresetId;
  readonly label: string;
  readonly split: EvalSplit;
  readonly runs: number;
  /** Limits the run to the first N reports of the split (smoke test). */
  readonly reportLimit: number | null;
  /**
   * `selected` runs the chosen variant; a list of ids runs exactly those variants, in that
   * order, whatever is selected.
   */
  readonly variants: 'selected' | readonly string[];
}

export const EVAL_PRESETS: readonly EvalPreset[] = [
  {
    id: 'smoke',
    label: '1. Smoke test (1 report)',
    split: 'dev',
    runs: 1,
    reportLimit: 1,
    variants: 'selected',
  },
  {
    id: 'dev',
    label: '2. Dev split (8 reports, 1 run)',
    split: 'dev',
    runs: 1,
    reportLimit: null,
    variants: 'selected',
  },
  {
    id: 'dev3',
    label: '3. Dev split, 3 runs',
    split: 'dev',
    runs: 3,
    reportLimit: null,
    variants: 'selected',
  },
  {
    id: 'devMatrix',
    label: `4. Dev matrix: ${MATRIX_VARIANT_IDS.length} round-1 variants x dev x 3 runs`,
    split: 'dev',
    runs: 3,
    reportLimit: null,
    variants: MATRIX_VARIANT_IDS,
  },
  {
    id: 'round2',
    label: `5. Round 2: dev x 3 runs, 2 variants only (${ROUND2_VARIANT_IDS.join(' + ')})`,
    split: 'dev',
    runs: 3,
    reportLimit: null,
    variants: ROUND2_VARIANT_IDS,
  },
  {
    id: 'full',
    label: '6. Full evaluation (test split, 3 runs)',
    split: 'test',
    runs: 3,
    reportLimit: null,
    variants: 'selected',
  },
];

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
  const found = preset.variants.flatMap((id) => findVariant(id) ?? []);
  const missing = preset.variants.filter((id) => findVariant(id) === undefined);
  if (missing.length > 0) {
    return err(createAppError('Misconfigured', { message: 'Unknown variant in preset.', missing }));
  }
  return ok(found);
}
