import { MODEL_CHUNK_CHARS, STRATEGIES, type StrategyName } from '../ai/prompts/identityScan.v1';
import type { PromptModule } from '../ai/prompts/promptModule';
import { DEFAULT_PROMPT_MODULE, getPromptModule } from '../ai/prompts/promptRegistry';
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
import { createSerialQueue, type SerialQueue } from '../infrastructure/ai/serialQueue';
import { createStuckTracker, type StuckTracker } from '../infrastructure/ai/stuckTracker';
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
const DEFAULT_STRATEGY: StrategyName = 'single';

type ScanGroups = readonly (readonly ModelFindingCategory[])[];

/** What defines a scanner pipeline; the eval variant registry satisfies it structurally. */
export interface ScanVariantSpec {
  readonly promptVersion: string;
  readonly strategy: StrategyName;
  readonly chunkChars: number;
}

const DEFAULT_VARIANT: ScanVariantSpec = {
  promptVersion: DEFAULT_PROMPT_MODULE.version,
  strategy: DEFAULT_STRATEGY,
  chunkChars: MODEL_CHUNK_CHARS,
};

export interface ServiceOptions {
  /** Scan variant; only the developer evaluation page overrides the default. */
  readonly variant?: ScanVariantSpec;
}

/** Caller-facing limit for one on-device call; to be tuned from eval latency (p50/max). */
const ON_DEVICE_TIMEOUT_MS = 120_000;

function createFakeAi(): AiServices {
  return {
    identityScanner: new FakeIdentityScanner(),
    deviceCapability: new FakeDeviceCapability(),
  };
}

/** Shared by every strategy: one Chrome session at a time (queue), one stuck state. */
interface OnDeviceInfra {
  readonly queue: SerialQueue;
  readonly stuck: StuckTracker;
  readonly chrome: ReturnType<typeof createDeviceCapability>;
}

function createOnDeviceInfra(): OnDeviceInfra {
  return {
    queue: createSerialQueue(),
    stuck: createStuckTracker(),
    chrome: createDeviceCapability(),
  };
}

function createRealAi(
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
    prompt.buildUserPrompt,
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

function bindScanReport(scanner: IdentityScanner, chunkChars: number): Services['scanReport'] {
  return (text, onProgress) =>
    scanReport(
      text,
      { scanner, clock: systemClock, chunkChars },
      onProgress === undefined ? {} : { onProgress },
    );
}

function buildServices(ai: AiServices, chunkChars: number): Services {
  return { ...ai, scanReport: bindScanReport(ai.identityScanner, chunkChars) };
}

function variantKey(v: ScanVariantSpec): string {
  return `${v.promptVersion}|${v.strategy}|${v.chunkChars}`;
}

/**
 * Services for any scan variant over ONE shared on-device queue and stuck tracker, so
 * switching variant can never open a second Chrome session. Instances are cached per variant.
 * An unregistered prompt version is a programming error and throws.
 */
export function createVariantServices(env: AppEnv): (variant: ScanVariantSpec) => Services {
  const infra = env.aiMode === 'fake' ? null : createOnDeviceInfra();
  const cache = new Map<string, Services>();
  return (variant) => {
    const key = variantKey(variant);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const prompt = getPromptModule(variant.promptVersion);
    if (prompt === undefined) throw new Error(`Unknown prompt version: ${variant.promptVersion}`);
    const groups: ScanGroups = STRATEGIES[variant.strategy];
    const ai = infra === null ? createFakeAi() : createRealAi(env, groups, prompt, infra);
    const services = buildServices(ai, variant.chunkChars);
    cache.set(key, services);
    return services;
  };
}

/** Builds the app services: deterministic fakes for `fake` AI mode, Chrome + Firebase otherwise. */
export function createServices(env: AppEnv, options: ServiceOptions = {}): Services {
  return createVariantServices(env)(options.variant ?? DEFAULT_VARIANT);
}
