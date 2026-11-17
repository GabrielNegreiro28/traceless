import type { AI } from 'firebase/ai';
import { DISCLOSURE_VERIFY_V1 } from '../ai/prompts/disclosureVerify.v1';
import type { DeviceCapability } from '../application/ports/DeviceCapability';
import { disclosureVerifyModelSpec } from '../infrastructure/ai/adapters/disclosureVerifyModelSpec';
import { identityScanModelSpec } from '../infrastructure/ai/adapters/identityScanModelSpec';
import type { ChromeDeviceCapability, DeviceModel } from '../infrastructure/ai/deviceCapability';
import { createOnDeviceModel, type OnDeviceModelSpec } from '../infrastructure/ai/modelFactory';
import type { AppError } from '../shared/appError';
import { ok, type Result } from '../shared/result';
import type { ScanSetup } from './scanBinding';

/** Part of the composition root: "Prepare private AI" for every on-device task of a pipeline. */

/**
 * One model per on-device task the pipeline runs: the first category group of each scan pass
 * (Chrome downloads one model per browser, so one group per prompt is enough) and, with
 * `verify`, the candidate verifier.
 */
export function prepareSpecs(
  scans: readonly ScanSetup[],
  verify: boolean,
): readonly OnDeviceModelSpec[] {
  const scanSpecs = scans.map(({ groups, prompt }) =>
    identityScanModelSpec(groups[0] ?? [], prompt),
  );
  return verify ? [...scanSpecs, disclosureVerifyModelSpec(DISCLOSURE_VERIFY_V1)] : scanSpecs;
}

/**
 * Prepares every model at once, so all of them start inside the reporter's click (Chrome only
 * starts a download with user activation, which a long first download would outlive).
 * Progress is the mean of the models' fractions; a model counts as done when it settles.
 * The first failure, in model order, is the answer.
 */
export async function prepareModels(
  chrome: Pick<ChromeDeviceCapability, 'prepare'>,
  models: readonly DeviceModel[],
  onProgress: (fraction: number) => void,
): Promise<Result<void, AppError>> {
  const fractions = models.map(() => 0);
  const update = (index: number, fraction: number): void => {
    fractions[index] = fraction;
    onProgress(fractions.reduce((sum, f) => sum + f, 0) / Math.max(1, fractions.length));
  };
  const results = await Promise.all(
    models.map(async (model, index) => {
      const result = await chrome.prepare(model, (fraction) => update(index, fraction));
      if (result.ok) update(index, 1);
      return result;
    }),
  );
  return results.find((result) => !result.ok) ?? ok(undefined);
}

/** The pipeline's `prepare`: creates its on-device models, then prepares them all. */
export function createPipelinePrepare(
  ai: AI,
  specs: readonly OnDeviceModelSpec[],
  chrome: Pick<ChromeDeviceCapability, 'prepare'>,
): DeviceCapability['prepare'] {
  return async (onProgress) => {
    const models: DeviceModel[] = [];
    for (const spec of specs) {
      const model = createOnDeviceModel(ai, spec);
      if (!model.ok) return model;
      models.push(model.value);
    }
    return prepareModels(chrome, models, onProgress);
  };
}
