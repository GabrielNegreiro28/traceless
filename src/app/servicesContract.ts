import type { ConfigService } from '../application/ports/ConfigService';
import type { DeviceCapability } from '../application/ports/DeviceCapability';
import type { IdentityScanner } from '../application/ports/IdentityScanner';
import type { PrivacyLedgerView } from '../application/ports/PrivacyLedger';
import type { CaseRecord } from '../application/ports/ReportRepository';
import type { ApprovedReport, ApproveReportInput } from '../application/usecases/approveReport';
import type { CloudScanConsent } from '../application/usecases/consentToCloudScan';
import type { ScanReportResult } from '../application/usecases/scanReport';
import type { RulesOnlyScanResult } from '../application/usecases/scanReportRulesOnly';
import type { StructureOutcome } from '../application/ports/ReportStructurer';
import type { SubmitDetails, SubmittedReport } from '../application/usecases/submitReport';
import type { CaseKey } from '../domain/case/caseKey';
import type { RawText, SanitizedText } from '../domain/text/brandedText';
import type { AppError } from '../shared/appError';
import type { Result } from '../shared/result';

/** What features receive from the composition root, through useServices(). */

export type ProgressCallback = (done: number, total: number) => void;

/** `Services.scanWithCloudConsent`: the reporter's consent travels with every call. */
export type CloudScanService = (
  text: RawText,
  consent: CloudScanConsent,
  onProgress?: ProgressCallback,
  isCancelled?: () => boolean,
) => Promise<Result<ScanReportResult, AppError>>;

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
   * The consented cloud scan (design plan §2b), the ONLY cloud path for the reporter's raw
   * text: reads the kill switch, checks the consent for this exact text, then scans in the
   * cloud. Recorded in the privacy ledger as consented raw text, never as on-device.
   */
  readonly scanWithCloudConsent: CloudScanService;
  /**
   * Basic checks: pattern rules only, never a model (after a terminal on-device stall, §G.2,
   * or chosen directly when on-device AI is unavailable); recorded with source `rules`.
   */
  readonly scanRulesOnly: (text: RawText) => RulesOnlyScanResult;
  /** The only way features create SanitizedText (the reporter's explicit approval). */
  readonly approveReport: (input: ApproveReportInput) => Result<ApprovedReport, AppError>;
  /** A fresh 128-bit case key from the CSPRNG (ADR 0003); kept in memory only by the caller. */
  readonly issueCaseKey: () => CaseKey;
  /**
   * Sends the approved report to the organization (Fase 4) under `caseKey`. Accepts only
   * SanitizedText; signs in anonymously at this moment; fails at once when offline (no queued
   * submit). Idempotent for the same text and key, so a retry after an unconfirmed send never
   * creates a second case. Recorded in the privacy ledger.
   */
  readonly submitReport: (
    text: SanitizedText,
    caseKey: CaseKey,
    /** Optional: the category from structureReport, as the reporter left it. */
    details?: SubmitDetails,
  ) => Promise<Result<SubmittedReport, AppError>>;
  /**
   * Organizes the approved text (category, summary, when, where) on the hybrid model:
   * PREFER_IN_CLOUD, so in the cloud, falling back to the device when the cloud is unreachable.
   * Accepts only SanitizedText; optional, never blocks sending. Recorded in the privacy ledger
   * with where it really ran.
   */
  readonly structureReport: (text: SanitizedText) => Promise<Result<StructureOutcome, AppError>>;
  /** The read-only follow-up: one case by the key the reporter typed (NotFound otherwise). */
  readonly lookUpCase: (input: string) => Promise<Result<CaseRecord, AppError>>;
  /** Session-only record of what happened to the text (read-only; the root records). */
  readonly privacyLedger: PrivacyLedgerView;
  /** Remote Config (the `cloud_scan_enabled` kill switch); `load()` never rejects. */
  readonly config: ConfigService;
  /**
   * Best-effort early load of lazy analysers (the Layer-2 text analyser), so a first scan made
   * offline still has them. Never throws; a failed load is retried by the next scan.
   */
  readonly preloadAnalysers: () => void;
  /** True when deterministic demo scanners stand in for the AI (fake AI mode). */
  readonly demoAi: boolean;
}
