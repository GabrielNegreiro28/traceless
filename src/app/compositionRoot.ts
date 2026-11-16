import { getPromptModule } from '../ai/prompts/promptRegistry';
import { SHIPPED_SCAN_PIPELINE, type ScanPipelineSpec } from '../ai/prompts/scanPipelines';
import { STRATEGIES } from '../ai/prompts/strategies';
import type { ConfigService } from '../application/ports/ConfigService';
import type { ConsentedIdentityScanner } from '../application/ports/ConsentedIdentityScanner';
import type { IdentityScanner } from '../application/ports/IdentityScanner';
import type { PrivacyLedger } from '../application/ports/PrivacyLedger';
import { approveReport } from '../application/usecases/approveReport';
import { scanReport } from '../application/usecases/scanReport';
import { scanReportRulesOnly } from '../application/usecases/scanReportRulesOnly';
import { systemClock } from '../infrastructure/clock/systemClock';
import { FakeConfigService } from '../infrastructure/fakes/FakeConfigService';
import { FakeConsentedIdentityScanner } from '../infrastructure/fakes/FakeConsentedIdentityScanner';
import { FakeDeviceCapability } from '../infrastructure/fakes/FakeDeviceCapability';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { createInMemoryPrivacyLedger } from '../infrastructure/ledger/inMemoryPrivacyLedger';
import {
  bindCaseServices,
  createFakeCaseBackend,
  createRealCaseBackend,
  type CaseBackend,
  type CaseServices,
} from './caseServices';
import { bindCloudScan, createConfigService, createConsentedCloudScanner } from './cloudAi';
import type { AppEnv } from './env';
import {
  ledgerView,
  withApprovalLedger,
  withCloudScanLedger,
  withRulesOnlyLedger,
  withScanLedger,
  type ScannerKind,
} from './ledgerDecorators';
import { createOnDeviceInfra, createRealAi, type AiServices, type ScanGroups } from './onDeviceAi';
import type { Services } from './servicesContract';

export type { ProgressCallback, Services } from './servicesContract';

/**
 * Composition root (PLANO §1, rule 1): the only place that picks concrete adapters.
 * The app builds these services once in src/app/bootstrap.ts and hands them to features
 * through the ServicesProvider (features read them with useServices()).
 */

/** What defines a scanner pipeline; the eval variant registry satisfies it structurally. */
export type ScanVariantSpec = ScanPipelineSpec;

/**
 * The product default: v2-single2 (identityScan.v2, strategy single2, the shipped chunk size,
 * post-filters protectedMentions + thirdPerson, core rules), identical to the `v2-single2` eval
 * variant. The first-person rule pack (§G.3) stays off until the test split decides (§G.4).
 * docs/design/fase2-gate-iteration.md §G.1: a default BY DOMINANCE on the dev matrix, NOT a
 * gate pass; the final default is whichever variant goes to the test split.
 */
const DEFAULT_VARIANT: ScanVariantSpec = SHIPPED_SCAN_PIPELINE;

/** Test doubles for fake AI mode (ignored with real AI, except `config`). */
export interface ServiceFakes {
  /** The consented cloud demo scanner (default: answers no findings, IN_CLOUD). */
  readonly fakeConsentedScanner?: ConsentedIdentityScanner;
  /** Replaces the config service in any mode (tests of the kill switch). */
  readonly config?: ConfigService;
  /** Replaces the auth + report repository in any mode (tests of sending and follow-up). */
  readonly caseBackend?: CaseBackend;
}

export interface ServiceOptions extends ServiceFakes {
  /** Scan variant; only the developer evaluation page overrides the default. */
  readonly variant?: ScanVariantSpec;
  /** Fake AI mode only: the demo scanner to use (tests); ignored with real AI. */
  readonly fakeScanner?: IdentityScanner;
}

function createFakeAi(scanner?: IdentityScanner): AiServices {
  return {
    identityScanner: scanner ?? new FakeIdentityScanner(),
    deviceCapability: new FakeDeviceCapability(),
  };
}

function bindScanReport(
  scanner: IdentityScanner,
  variant: ScanVariantSpec,
): Services['scanReport'] {
  const { chunkChars, postFilters, rulePack } = variant;
  return (text, onProgress, isCancelled) =>
    scanReport(
      text,
      { scanner, clock: systemClock, chunkChars, postFilters, rulePack },
      {
        ...(onProgress === undefined ? {} : { onProgress }),
        ...(isCancelled === undefined ? {} : { isCancelled }),
      },
    );
}

/** Shared by every variant: one ledger and one config per app, and whether AI is the demo. */
interface AppContext {
  readonly ledger: PrivacyLedger;
  readonly kind: ScannerKind;
  readonly config: ConfigService;
  /** Sending and follow-up: one backend per app, shared by every variant. */
  readonly cases: CaseServices;
}

interface VariantAi extends AiServices {
  readonly consentedScanner: ConsentedIdentityScanner;
}

function buildServices(ai: VariantAi, variant: ScanVariantSpec, context: AppContext): Services {
  const { ledger, kind, config, cases } = context;
  const { consentedScanner, ...onDevice } = ai;
  const scan = bindScanReport(ai.identityScanner, variant);
  const cloudScan = bindCloudScan(consentedScanner, config, variant);
  const approve: Services['approveReport'] = (input) =>
    approveReport(input, { clock: systemClock });
  return {
    ...onDevice,
    scanReport: withScanLedger(scan, ledger, systemClock, kind),
    scanWithCloudConsent: withCloudScanLedger(cloudScan, ledger, systemClock, kind),
    scanRulesOnly: withRulesOnlyLedger(scanReportRulesOnly, ledger, systemClock),
    approveReport: withApprovalLedger(approve, ledger),
    ...cases,
    privacyLedger: ledgerView(ledger),
    config,
    demoAi: kind === 'demo',
  };
}

function variantKey(v: ScanVariantSpec): string {
  return `${v.promptVersion}|${v.strategy}|${v.chunkChars}|${v.postFilters.join(',')}|${v.rulePack}`;
}

function appContext(env: AppEnv, demo: boolean, fakes: ServiceFakes): AppContext {
  const fallback = demo ? new FakeConfigService() : createConfigService(env);
  const backend =
    fakes.caseBackend ?? (demo ? createFakeCaseBackend() : createRealCaseBackend(env));
  const ledger = createInMemoryPrivacyLedger();
  const kind: ScannerKind = demo ? 'demo' : 'onDevice';
  return {
    ledger,
    kind,
    config: fakes.config ?? fallback,
    cases: bindCaseServices(backend, ledger, { now: () => Date.now() }, kind),
  };
}

/**
 * Services for any scan variant over ONE shared on-device queue and stuck tracker, so
 * switching variant can never open a second Chrome session. Instances are cached per variant.
 * An unregistered prompt version is a programming error and throws.
 */
export function createVariantServices(
  env: AppEnv,
  fakeScanner?: IdentityScanner,
  fakes: ServiceFakes = {},
): (variant: ScanVariantSpec) => Services {
  const infra = env.aiMode === 'fake' ? null : createOnDeviceInfra();
  const context = appContext(env, infra === null, fakes);
  const cache = new Map<string, Services>();
  return (variant) => {
    const key = variantKey(variant);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const prompt = getPromptModule(variant.promptVersion);
    if (prompt === undefined) throw new Error(`Unknown prompt version: ${variant.promptVersion}`);
    const groups: ScanGroups = STRATEGIES[variant.strategy];
    const ai: VariantAi =
      infra === null
        ? {
            ...createFakeAi(fakeScanner),
            consentedScanner: fakes.fakeConsentedScanner ?? new FakeConsentedIdentityScanner(),
          }
        : {
            ...createRealAi(env, groups, prompt, infra),
            consentedScanner: createConsentedCloudScanner(env, groups, prompt),
          };
    const services = buildServices(ai, variant, context);
    cache.set(key, services);
    return services;
  };
}

/** Builds the app services: deterministic fakes for `fake` AI mode, Chrome + Firebase otherwise. */
export function createServices(env: AppEnv, options: ServiceOptions = {}): Services {
  return createVariantServices(
    env,
    options.fakeScanner,
    options,
  )(options.variant ?? DEFAULT_VARIANT);
}
