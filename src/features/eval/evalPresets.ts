import type { EvalSplit } from '../../application/usecases/evaluateDetection';
import type { Dataset } from '../../domain/evaluation/datasetSchema';

export type PresetId = 'smoke' | 'dev' | 'full';

export interface EvalPreset {
  readonly id: PresetId;
  readonly label: string;
  readonly split: EvalSplit;
  readonly runs: number;
  /** Limits the run to the first N reports of the split (smoke test). */
  readonly reportLimit: number | null;
}

export const EVAL_PRESETS: readonly EvalPreset[] = [
  { id: 'smoke', label: '1. Smoke test (1 report)', split: 'dev', runs: 1, reportLimit: 1 },
  { id: 'dev', label: '2. Dev split (8 reports, 1 run)', split: 'dev', runs: 1, reportLimit: null },
  {
    id: 'full',
    label: '3. Full evaluation (test split, 3 runs)',
    split: 'test',
    runs: 3,
    reportLimit: null,
  },
];

/** The dataset restricted to what the preset evaluates. */
export function datasetForPreset(dataset: Dataset, preset: EvalPreset): Dataset {
  if (preset.reportLimit === null) return dataset;
  const inSplit = dataset.reports.filter((r) => preset.split === 'all' || r.split === preset.split);
  return { ...dataset, reports: inSplit.slice(0, preset.reportLimit) };
}
