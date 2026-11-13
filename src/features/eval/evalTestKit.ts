import type { DeviceAvailability } from '../../application/ports/DeviceCapability';
import type { EvalScan } from '../../application/usecases/evaluateDetection';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import { ok } from '../../shared/result';
import type { EvalServices } from './evalServices';

/** Fakes for the evaluation page tests (features may not import src/infrastructure). */

export const TEST_DATASET: Dataset = {
  version: 'test-v1',
  reports: ['a', 'b'].map((id) => ({
    id,
    sector: 'test',
    split: 'dev' as const,
    text: 'Plain words with nothing identifying.',
    gold: [],
    mustNotFlag: [],
  })),
};

export const EMPTY_SCAN: EvalScan = () =>
  Promise.resolve(
    ok({
      findings: [],
      modelFindings: [],
      source: 'ON_DEVICE' as const,
      stats: {
        chunks: 1,
        rawModelFindings: 0,
        locatedModelFindings: 0,
        unlocatedModelFindings: 0,
        retries: 0,
        durationMs: 5,
      },
    }),
  );

export interface FakeDevice {
  readonly capability: EvalServices['deviceCapability'];
  readonly prepareCalls: () => number;
}

export function fakeDevice(initial: DeviceAvailability): FakeDevice {
  let availability = initial;
  let calls = 0;
  return {
    capability: {
      check: () => Promise.resolve(availability),
      prepare: (onProgress) => {
        calls += 1;
        onProgress(0.5);
        availability = 'available';
        return Promise.resolve(ok(undefined));
      },
    },
    prepareCalls: () => calls,
  };
}

export function fakeServices(overrides: Partial<EvalServices> = {}): EvalServices {
  let tick = 0;
  return {
    deviceCapability: fakeDevice('available').capability,
    dataset: TEST_DATASET,
    clock: { now: () => (tick += 100) },
    promptVersion: 'identityScan.v1',
    scanFor: () => EMPTY_SCAN,
    saveResult: () => Promise.resolve(ok('saved-file.json')),
    ...overrides,
  };
}
