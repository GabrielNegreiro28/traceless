import { createContext, useContext } from 'react';
import type { Clock } from '../../application/ports/Clock';
import type { DeviceCapability } from '../../application/ports/DeviceCapability';
import type { EvalRunResult, EvalScan } from '../../application/usecases/evaluateDetection';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';

export const EVAL_STRATEGIES = ['single', 'grouped2'] as const;
export type EvalStrategy = (typeof EVAL_STRATEGIES)[number];

/** Everything the evaluation page needs; built in src/app so features stay adapter-free. */
export interface EvalServices {
  readonly deviceCapability: DeviceCapability;
  readonly dataset: Dataset;
  readonly clock: Clock;
  readonly promptVersion: string;
  /** Scan function for a prompt strategy (wraps the real or fake scanner). */
  readonly scanFor: (strategy: EvalStrategy) => EvalScan;
  /** Saves a result under eval/results/ via the dev server; resolves to the file name. */
  readonly saveResult: (result: EvalRunResult) => Promise<Result<string, AppError>>;
}

export const EvalServicesContext = createContext<EvalServices | null>(null);

export function useEvalServices(): EvalServices {
  const services = useContext(EvalServicesContext);
  if (services === null) throw new Error('useEvalServices needs an EvalServicesProvider.');
  return services;
}
