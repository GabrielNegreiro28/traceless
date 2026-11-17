import { createContext, useContext } from 'react';
import type { Clock } from '../../application/ports/Clock';
import type { DeviceCapability } from '../../application/ports/DeviceCapability';
import type { EvalRunResult, EvalScan } from '../../application/usecases/evaluateDetection';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';
import type { EvalVariant } from './evalVariants';

/** Everything the evaluation page needs; built in src/app so features stay adapter-free. */
export interface EvalServices {
  readonly deviceCapability: DeviceCapability;
  /** reports.v1: the dev split, the old test split, and together the round-3 dev pool. */
  readonly dataset: Dataset;
  /** The held-out v2 test split (preset 8 only); absent in tests that do not need it. */
  readonly v2TestDataset?: Dataset;
  readonly clock: Clock;
  /** Scan function for a variant (wraps the real or fake scanner, shared on-device queue). */
  readonly scanFor: (variant: EvalVariant) => EvalScan;
  /** Saves a result under eval/results/ via the dev server; resolves to the file name. */
  readonly saveResult: (result: EvalRunResult) => Promise<Result<string, AppError>>;
}

export const EvalServicesContext = createContext<EvalServices | null>(null);

export function useEvalServices(): EvalServices {
  const services = useContext(EvalServicesContext);
  if (services === null) throw new Error('useEvalServices needs an EvalServicesProvider.');
  return services;
}
