import { getPromptModule } from '../ai/prompts/promptRegistry';
import { SHIPPED_SCAN_PIPELINE, type ScanPipelineSpec } from '../ai/prompts/scanPipelines';
import { STRATEGIES } from '../ai/prompts/strategies';
import type { DeviceCapability } from '../application/ports/DeviceCapability';
import type { IdentityScanner } from '../application/ports/IdentityScanner';
import type { PrivacyLedger, PrivacyLedgerView } from '../application/ports/PrivacyLedger';
import {
  approveReport,
  type ApprovedReport,
  type ApproveReportInput,
} from '../application/usecases/approveReport';
import { scanReport, type ScanReportResult } from '../application/usecases/scanReport';
import {
  scanReportRulesOnly,
  type RulesOnlyScanResult,
} from '../application/usecases/scanReportRulesOnly';
import type { RawText } from '../domain/text/brandedText';
import { systemClock } from '../infrastructure/clock/systemClock';
import { FakeDeviceCapability } from '../infrastructure/fakes/FakeDeviceCapability';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { createInMemoryPrivacyLedger } from '../infrastructure/ledger/inMemoryPrivacyLedger';
import type { AppError } from '../shared/appError';
import type { Result } from '../shared/result';
import type { AppEnv } from './env';
import {
  ledgerView,
  withApprovalLedger,
  withRulesOnlyLedger,
  withScanLedger,
  type ScannerKind,
} from './ledgerDecorators';
import { createOnDeviceInfra, createRealAi, type AiServices, type ScanGroups } from './onDeviceAi';

/**
 * Composition root (PLANO §1, rule 1): the only place that picks concrete adapters.
 * The app builds these services once in src/app/bootstrap.ts and hands them to features
 * through the ServicesProvider (features read them with useServices()).
 */

export type ProgressCallback = (done: number, total: number) => void;

export interface Services {
  readonly identityScanner: IdentityScanner;
  readonly deviceCapability: DeviceCapability;
  readonly scanReport: (
    text: RawText,
    onProgress?: ProgressCallback,
    /** Polled before each chunk; when true the scan stops with a Cancelled error. */
    isCancelled?: () => boolean,
  ) => Promise<Result<ScanReportResult, AppError>>;
  /**
   * "Continue with basic checks" after a terminal on-device stall (§G.2): pattern rules only,
   * never a model; recorded in the privacy ledger with source `rules`.
   */
  readonly scanRulesOnly: (text: RawText) => RulesOnlyScanResult;
  /** The only way features create SanitizedText (the reporter's explicit approval). */
  readonly approveReport: (input: ApproveReportInput) => Result<ApprovedReport, AppError>;
  /** Session-only record of what happened to the text (read-only; the root records). */
  readonly privacyLedger: PrivacyLedgerView;
}

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

export interface ServiceOptions {
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

/** Shared by every variant: one ledger per app, and whether the scanner is the demo fake. */
interface LedgerContext {
  readonly ledger: PrivacyLedger;
  readonly kind: ScannerKind;
}

function buildServices(ai: AiServices, variant: ScanVariantSpec, context: LedgerContext): Services {
  const { ledger, kind } = context;
  const scan = bindScanReport(ai.identityScanner, variant);
  const approve: Services['approveReport'] = (input) =>
    approveReport(input, { clock: systemClock });
  return {
    ...ai,
    scanReport: withScanLedger(scan, ledger, systemClock, kind),
    scanRulesOnly: withRulesOnlyLedger(scanReportRulesOnly, ledger, systemClock),
    approveReport: withApprovalLedger(approve, ledger),
    privacyLedger: ledgerView(ledger),
  };
}

function variantKey(v: ScanVariantSpec): string {
  return `${v.promptVersion}|${v.strategy}|${v.chunkChars}|${v.postFilters.join(',')}|${v.rulePack}`;
}

/**
 * Services for any scan variant over ONE shared on-device queue and stuck tracker, so
 * switching variant can never open a second Chrome session. Instances are cached per variant.
 * An unregistered prompt version is a programming error and throws.
 */
export function createVariantServices(
  env: AppEnv,
  fakeScanner?: IdentityScanner,
): (variant: ScanVariantSpec) => Services {
  const infra = env.aiMode === 'fake' ? null : createOnDeviceInfra();
  const context: LedgerContext = {
    ledger: createInMemoryPrivacyLedger(),
    kind: infra === null ? 'demo' : 'onDevice',
  };
  const cache = new Map<string, Services>();
  return (variant) => {
    const key = variantKey(variant);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const prompt = getPromptModule(variant.promptVersion);
    if (prompt === undefined) throw new Error(`Unknown prompt version: ${variant.promptVersion}`);
    const groups: ScanGroups = STRATEGIES[variant.strategy];
    const ai =
      infra === null ? createFakeAi(fakeScanner) : createRealAi(env, groups, prompt, infra);
    const services = buildServices(ai, variant, context);
    cache.set(key, services);
    return services;
  };
}

/** Builds the app services: deterministic fakes for `fake` AI mode, Chrome + Firebase otherwise. */
export function createServices(env: AppEnv, options: ServiceOptions = {}): Services {
  return createVariantServices(env, options.fakeScanner)(options.variant ?? DEFAULT_VARIANT);
}
