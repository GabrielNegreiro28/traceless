import { IDENTITY_SCAN_PROMPT_VERSION } from '../ai/prompts/identityScan.v1';
import { parseDataset } from '../domain/evaluation/datasetSchema';
import { systemClock } from '../infrastructure/clock/systemClock';
import { EvalPage } from '../features/eval/EvalPage';
import type { EvalServices } from '../features/eval/evalServices';
import { EvalServicesProvider } from '../features/eval/EvalServicesContext';
import { createAppError, type AppError } from '../shared/appError';
import { err, ok, type Result } from '../shared/result';
import datasetText from '../../eval/datasets/reports.v1.json?raw';
import { createStrategyServices } from './compositionRoot';
import { readEnv } from './env';
import { saveEvalResult } from './evalResultsClient';

function buildEvalServices(): Result<EvalServices, AppError> {
  const env = readEnv();
  if (!env.ok) return env;
  let json: unknown;
  try {
    json = JSON.parse(datasetText);
  } catch {
    return err(createAppError('Misconfigured', { message: 'Dataset is not JSON.', missing: [] }));
  }
  const dataset = parseDataset(json);
  if (!dataset.ok) return dataset;
  // One factory, hence one shared on-device queue and stuck tracker, for every strategy.
  const servicesFor = createStrategyServices(env.value);
  return ok({
    deviceCapability: servicesFor('single').deviceCapability,
    dataset: dataset.value,
    clock: systemClock,
    promptVersion: IDENTITY_SCAN_PROMPT_VERSION,
    scanFor: (strategy) => (text) => servicesFor(strategy).scanReport(text),
    saveResult: saveEvalResult,
  });
}

/** Module scope (not useMemo): Fast Refresh must not create a second on-device queue. */
let cachedServices: Result<EvalServices, AppError> | null = null;

function evalServices(): Result<EvalServices, AppError> {
  cachedServices ??= buildEvalServices();
  return cachedServices;
}

/** Route element for /eval: composes the services here so the feature stays adapter-free. */
export default function EvalRoute() {
  const services = evalServices();
  if (!services.ok) {
    return (
      <main className="p-6 text-danger" role="alert">
        The evaluation tool is not set up: {services.error.message}
      </main>
    );
  }
  return (
    <EvalServicesProvider services={services.value}>
      <EvalPage />
    </EvalServicesProvider>
  );
}
