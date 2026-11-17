import {
  CONSENTED_CLOUD_SCAN_PASS,
  SHIPPED_SCAN_PIPELINE,
  type ScanPipelineSpec,
} from '../ai/prompts/scanPipelines';
import type { ConfigService } from '../application/ports/ConfigService';
import type { ConsentedIdentityScanner } from '../application/ports/ConsentedIdentityScanner';
import type { IdentityScanner } from '../application/ports/IdentityScanner';
import type { PrivacyLedger } from '../application/ports/PrivacyLedger';
import type { ReportStructurer } from '../application/ports/ReportStructurer';
import { approveReport } from '../application/usecases/approveReport';
import { scanReportRulesOnly } from '../application/usecases/scanReportRulesOnly';
import { systemClock } from '../infrastructure/clock/systemClock';
import { FakeConfigService } from '../infrastructure/fakes/FakeConfigService';
import { FakeConsentedIdentityScanner } from '../infrastructure/fakes/FakeConsentedIdentityScanner';
import { FakeDeviceCapability } from '../infrastructure/fakes/FakeDeviceCapability';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { FakeReportStructurer } from '../infrastructure/fakes/FakeReportStructurer';
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
import { createOnDeviceInfra, createRealAi, type AiServices } from './onDeviceAi';
import { bindScanReport, resolveScanPass, resolveScanSetups, variantKey } from './scanBinding';
import type { Services } from './servicesContract';
import { bindStructureReport, createReportStructurer } from './structureServices';

export type { ProgressCallback, Services } from './servicesContract';

/**
 * Composition root (PLANO §1, rule 1): the only place that picks concrete adapters.
 * The app builds these services once in src/app/bootstrap.ts and hands them to features
 * through the ServicesProvider (features read them with useServices()).
 */

/** What defines a scanner pipeline; the eval variant registry satisfies it structurally. */
export type ScanVariantSpec = ScanPipelineSpec;

/**
 * The product default: SHIPPED_SCAN_PIPELINE, the `v3-verifier+investigator` eval variant
 * (investigator pass + on-device candidate verifier, first-person rules, v2 post-filters),
 * chosen by the pre-registered rule (docs/progress/DECISIONS.md, 2026-11-17).
 */
const DEFAULT_VARIANT: ScanVariantSpec = SHIPPED_SCAN_PIPELINE;

/** The consented cloud scan's pass (v2 prompt, single2), the same for every variant. */
const CLOUD_SCAN = resolveScanPass(CONSENTED_CLOUD_SCAN_PASS);

/** Test doubles for fake AI mode (ignored with real AI, except `config`). */
export interface ServiceFakes {
  /** The consented cloud demo scanner (default: answers no findings, IN_CLOUD). */
  readonly fakeConsentedScanner?: ConsentedIdentityScanner;
  /** Replaces the config service in any mode (tests of the kill switch). */
  readonly config?: ConfigService;
  /** Replaces the auth + report repository in any mode (tests of sending and follow-up). */
  readonly caseBackend?: CaseBackend;
  /** Replaces the report structurer in any mode (tests of the structured card). */
  readonly reportStructurer?: ReportStructurer;
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

/** Shared by every variant: one ledger and one config per app, and whether AI is the demo. */
interface AppContext {
  readonly ledger: PrivacyLedger;
  readonly kind: ScannerKind;
  readonly config: ConfigService;
  /** Sending and follow-up: one backend per app, shared by every variant. */
  readonly cases: CaseServices;
  /** structureReport (hybrid model, or the demo structurer): one per app. */
  readonly structure: Services['structureReport'];
}

interface VariantAi extends AiServices {
  readonly consentedScanner: ConsentedIdentityScanner;
}

function buildServices(ai: VariantAi, variant: ScanVariantSpec, context: AppContext): Services {
  const { ledger, kind, config, cases, structure } = context;
  const { consentedScanner, ...onDevice } = ai;
  const scan = bindScanReport(ai.identityScanner, variant, ai.disclosure);
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
    structureReport: structure,
    privacyLedger: ledgerView(ledger),
    config,
    demoAi: kind === 'demo',
  };
}

function appContext(env: AppEnv, demo: boolean, fakes: ServiceFakes): AppContext {
  const fallback = demo ? new FakeConfigService() : createConfigService(env);
  const backend =
    fakes.caseBackend ?? (demo ? createFakeCaseBackend() : createRealCaseBackend(env));
  const ledger = createInMemoryPrivacyLedger();
  const kind: ScannerKind = demo ? 'demo' : 'onDevice';
  const structurer =
    fakes.reportStructurer ?? (demo ? new FakeReportStructurer() : createReportStructurer(env));
  return {
    ledger,
    kind,
    config: fakes.config ?? fallback,
    cases: bindCaseServices(backend, ledger, { now: () => Date.now() }, kind),
    structure: bindStructureReport(structurer, ledger, systemClock, kind),
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
    const scans = resolveScanSetups(variant);
    if (scans.length === 0) throw new Error('A scan pipeline needs a scan pass.');
    const ai: VariantAi =
      infra === null
        ? {
            ...createFakeAi(fakeScanner),
            consentedScanner: fakes.fakeConsentedScanner ?? new FakeConsentedIdentityScanner(),
          }
        : {
            ...createRealAi(env, scans, infra, variant.verify === true),
            // Bound explicitly to the v2 cloud pass, never to the pipeline's passes; the
            // verifier reads RAW text and never runs in the cloud.
            consentedScanner: createConsentedCloudScanner(env, CLOUD_SCAN),
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
