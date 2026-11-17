import type { AI } from 'firebase/ai';
import { DISCLOSURE_VERIFY_V1 } from '../ai/prompts/disclosureVerify.v1';
import type { DeviceCapability } from '../application/ports/DeviceCapability';
import type { IdentityScanner } from '../application/ports/IdentityScanner';
import type { DisclosureVerification } from '../application/ports/DisclosureVerification';
import { disclosureVerifyModelSpec } from '../infrastructure/ai/adapters/disclosureVerifyModelSpec';
import { OnDeviceCandidateVerifier } from '../infrastructure/ai/adapters/OnDeviceCandidateVerifier';
import { OnDeviceIdentityScanner } from '../infrastructure/ai/adapters/OnDeviceIdentityScanner';
import { SequentialIdentityScanner } from '../infrastructure/ai/adapters/SequentialIdentityScanner';
import { identityScanModelSpec } from '../infrastructure/ai/adapters/identityScanModelSpec';
import { getAiService } from '../infrastructure/ai/aiService';
import { createDeviceCapability } from '../infrastructure/ai/deviceCapability';
import { createOnDeviceModel } from '../infrastructure/ai/modelFactory';
import { createOnDevicePromptRunner } from '../infrastructure/ai/onDevicePromptRunner';
import { createSerialQueue, type SerialQueue } from '../infrastructure/ai/serialQueue';
import { createStuckTracker, type StuckTracker } from '../infrastructure/ai/stuckTracker';
import type { AppEnv } from './env';
import { bootstrapFirebase } from './firebaseBootstrap';
import { createLazyCandidateFinder } from './lazyCandidateFinder';
import { createPipelinePrepare, prepareSpecs } from './onDevicePrepare';
import type { ScanSetup } from './scanBinding';

/** Part of the composition root: wires Chrome's on-device model (real AI mode only). */

export interface AiServices {
  readonly identityScanner: IdentityScanner;
  readonly deviceCapability: DeviceCapability;
  /** Only for pipelines with the verify pass (real AI mode). */
  readonly disclosure?: DisclosureVerification;
  /** Starts loading lazy modules early (best effort; never throws). */
  readonly preload?: () => void;
}

/** Caller-facing limit for one on-device call; to be tuned from eval latency (p50/max). */
const ON_DEVICE_TIMEOUT_MS = 120_000;

/** Shared by every strategy: one Chrome session at a time (queue), one stuck state. */
export interface OnDeviceInfra {
  readonly queue: SerialQueue;
  readonly stuck: StuckTracker;
  readonly chrome: ReturnType<typeof createDeviceCapability>;
}

export function createOnDeviceInfra(): OnDeviceInfra {
  return {
    queue: createSerialQueue(),
    stuck: createStuckTracker(),
    chrome: createDeviceCapability(),
  };
}

function runnerFactory(infra: OnDeviceInfra) {
  const { queue, stuck, chrome } = infra;
  return (getModel: () => ReturnType<typeof createOnDeviceModel>) =>
    createOnDevicePromptRunner({
      queue,
      stuck,
      capability: chrome,
      getModel,
      timeoutMs: ON_DEVICE_TIMEOUT_MS,
    });
}

/**
 * Layers 2 + 3a: the lazily loaded candidate finder and the verifier on the SAME queue and
 * stuck tracker as the scan passes (one Chrome session at a time, same stall recovery).
 */
function createDisclosure(ai: AI, runnerFor: ReturnType<typeof runnerFactory>) {
  const finder = createLazyCandidateFinder();
  const spec = disclosureVerifyModelSpec(DISCLOSURE_VERIFY_V1);
  const verifier = new OnDeviceCandidateVerifier(
    runnerFor(() => createOnDeviceModel(ai, spec)),
    DISCLOSURE_VERIFY_V1,
  );
  return { finder, verifier, preload: finder.preload };
}

/**
 * The on-device services of one pipeline: one scanner per scan pass (run in order on each
 * chunk, findings unioned) and, when `verify`, the candidate verifier.
 */
export function createRealAi(
  env: AppEnv,
  scans: readonly ScanSetup[],
  infra: OnDeviceInfra,
  verify: boolean,
): AiServices {
  const ai = getAiService(bootstrapFirebase(env));
  const runnerFor = runnerFactory(infra);
  const scanners = scans.map(
    ({ groups, prompt }) =>
      new OnDeviceIdentityScanner(
        groups,
        (group) => runnerFor(() => createOnDeviceModel(ai, identityScanModelSpec(group, prompt))),
        prompt,
      ),
  );
  const identityScanner =
    scanners.length === 1 && scanners[0] !== undefined
      ? scanners[0]
      : new SequentialIdentityScanner(scanners);
  const deviceCapability: DeviceCapability = {
    check: () => infra.chrome.check(),
    // Every on-device task of the pipeline (scan passes and verifier), inside the click.
    prepare: createPipelinePrepare(ai, prepareSpecs(scans, verify), infra.chrome),
  };
  const disclosure = verify ? createDisclosure(ai, runnerFor) : null;
  const disclosureServices =
    disclosure === null
      ? {}
      : {
          disclosure: { finder: disclosure.finder, verifier: disclosure.verifier },
          preload: disclosure.preload,
        };
  return {
    identityScanner,
    deviceCapability,
    ...disclosureServices,
  };
}
