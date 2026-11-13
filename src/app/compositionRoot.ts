import { MODEL_CHUNK_CHARS, STRATEGIES } from '../ai/prompts/identityScan.v1';
import type { ModelFindingCategory } from '../ai/schemas/identityScan';
import type { DeviceCapability } from '../application/ports/DeviceCapability';
import type { IdentityScanner } from '../application/ports/IdentityScanner';
import { scanReport, type ScanReportResult } from '../application/usecases/scanReport';
import type { RawText } from '../domain/text/brandedText';
import { OnDeviceIdentityScanner } from '../infrastructure/ai/adapters/OnDeviceIdentityScanner';
import { identityScanModelSpec } from '../infrastructure/ai/adapters/identityScanModelSpec';
import { getAiService } from '../infrastructure/ai/aiService';
import { createDeviceCapability } from '../infrastructure/ai/deviceCapability';
import { createOnDeviceModel } from '../infrastructure/ai/modelFactory';
import { createOnDevicePromptRunner } from '../infrastructure/ai/onDevicePromptRunner';
import { createSerialQueue } from '../infrastructure/ai/serialQueue';
import { systemClock } from '../infrastructure/clock/systemClock';
import { FakeDeviceCapability } from '../infrastructure/fakes/FakeDeviceCapability';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import type { AppError } from '../shared/appError';
import type { Result } from '../shared/result';
import type { AppEnv } from './env';
import { bootstrapFirebase } from './firebaseBootstrap';

/**
 * Composition root (PLANO §1, rule 1): the only place that picks concrete adapters.
 * Not wired into the UI yet; the ServicesProvider arrives in Fase 3.
 */

export type ProgressCallback = (done: number, total: number) => void;

export interface Services {
  readonly identityScanner: IdentityScanner;
  readonly deviceCapability: DeviceCapability;
  readonly scanReport: (
    text: RawText,
    onProgress?: ProgressCallback,
  ) => Promise<Result<ScanReportResult, AppError>>;
}

type AiServices = Pick<Services, 'identityScanner' | 'deviceCapability'>;

/** Shipped prompt strategy (design §1: switch to grouped2 only if eval justifies it). */
const SCAN_GROUPS = STRATEGIES.single;

/** Caller-facing limit for one on-device call; to be tuned from eval latency (p50/max). */
const ON_DEVICE_TIMEOUT_MS = 120_000;

function createFakeAi(): AiServices {
  return {
    identityScanner: new FakeIdentityScanner(),
    deviceCapability: new FakeDeviceCapability(),
  };
}

function createRealAi(env: AppEnv): AiServices {
  const ai = getAiService(bootstrapFirebase(env));
  const queue = createSerialQueue();
  const chrome = createDeviceCapability();
  const modelFor = (group: readonly ModelFindingCategory[]) =>
    createOnDeviceModel(ai, identityScanModelSpec(group));
  const identityScanner = new OnDeviceIdentityScanner(SCAN_GROUPS, (group) =>
    createOnDevicePromptRunner({
      queue,
      capability: chrome,
      getModel: () => modelFor(group),
      timeoutMs: ON_DEVICE_TIMEOUT_MS,
    }),
  );
  const deviceCapability: DeviceCapability = {
    check: () => chrome.check(),
    // Chrome downloads one model per browser, so the first group's model prepares all.
    prepare: async (onProgress) => {
      const model = modelFor(SCAN_GROUPS[0]);
      return model.ok ? chrome.prepare(model.value, onProgress) : model;
    },
  };
  return { identityScanner, deviceCapability };
}

function bindScanReport(scanner: IdentityScanner): Services['scanReport'] {
  return (text, onProgress) =>
    scanReport(
      text,
      { scanner, clock: systemClock, chunkChars: MODEL_CHUNK_CHARS },
      onProgress === undefined ? {} : { onProgress },
    );
}

/** Builds the app services: deterministic fakes for `fake` AI mode, Chrome + Firebase otherwise. */
export function createServices(env: AppEnv): Services {
  const ai = env.aiMode === 'fake' ? createFakeAi() : createRealAi(env);
  return { ...ai, scanReport: bindScanReport(ai.identityScanner) };
}
