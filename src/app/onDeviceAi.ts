import type { PromptModule } from '../ai/prompts/promptModule';
import type { ModelFindingCategory } from '../ai/schemas/identityScan';
import type { DeviceCapability } from '../application/ports/DeviceCapability';
import type { IdentityScanner } from '../application/ports/IdentityScanner';
import { OnDeviceIdentityScanner } from '../infrastructure/ai/adapters/OnDeviceIdentityScanner';
import { identityScanModelSpec } from '../infrastructure/ai/adapters/identityScanModelSpec';
import { getAiService } from '../infrastructure/ai/aiService';
import { createDeviceCapability } from '../infrastructure/ai/deviceCapability';
import { createOnDeviceModel } from '../infrastructure/ai/modelFactory';
import { createOnDevicePromptRunner } from '../infrastructure/ai/onDevicePromptRunner';
import { createSerialQueue, type SerialQueue } from '../infrastructure/ai/serialQueue';
import { createStuckTracker, type StuckTracker } from '../infrastructure/ai/stuckTracker';
import type { AppEnv } from './env';
import { bootstrapFirebase } from './firebaseBootstrap';

/** Part of the composition root: wires Chrome's on-device model (real AI mode only). */

export interface AiServices {
  readonly identityScanner: IdentityScanner;
  readonly deviceCapability: DeviceCapability;
}

export type ScanGroups = readonly (readonly ModelFindingCategory[])[];

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

export function createRealAi(
  env: AppEnv,
  scanGroups: ScanGroups,
  prompt: PromptModule,
  infra: OnDeviceInfra,
): AiServices {
  const ai = getAiService(bootstrapFirebase(env));
  const { queue, stuck, chrome } = infra;
  const modelFor = (group: readonly ModelFindingCategory[]) =>
    createOnDeviceModel(ai, identityScanModelSpec(group, prompt));
  const identityScanner = new OnDeviceIdentityScanner(
    scanGroups,
    (group) =>
      createOnDevicePromptRunner({
        queue,
        stuck,
        capability: chrome,
        getModel: () => modelFor(group),
        timeoutMs: ON_DEVICE_TIMEOUT_MS,
      }),
    prompt,
  );
  const deviceCapability: DeviceCapability = {
    check: () => chrome.check(),
    // Chrome downloads one model per browser, so the first group's model prepares all.
    prepare: async (onProgress) => {
      const model = modelFor(scanGroups[0] ?? []);
      return model.ok ? chrome.prepare(model.value, onProgress) : model;
    },
  };
  return { identityScanner, deviceCapability };
}
