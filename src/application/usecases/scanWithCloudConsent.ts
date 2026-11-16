import type { RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';
import type { ConfigService } from '../ports/ConfigService';
import { consentToCloudScan, type CloudScanConsent } from './consentToCloudScan';
import type { ScanReportOptions, ScanReportResult } from './scanPipeline';
import { scanReportConsented, type ScanReportConsentedDeps } from './scanReportConsented';

export interface ScanWithCloudConsentDeps extends ScanReportConsentedDeps {
  /** Read right before the scan, so the kill switch also stops a scan the UI still offered. */
  readonly config: ConfigService;
}

/**
 * "Check it in the cloud, with my consent": reads the kill switch, turns the reporter's
 * consent for this exact text into ConsentedRawText (consentToCloudScan) and only then runs
 * the consented scan. Without a valid consent, or with the switch off, the scanner is never
 * called and nothing leaves the device.
 */
export async function scanWithCloudConsent(
  text: RawText,
  consent: CloudScanConsent,
  deps: ScanWithCloudConsentDeps,
  options: ScanReportOptions = {},
): Promise<Result<ScanReportResult, AppError>> {
  const { cloudScanEnabled } = await deps.config.load();
  const consented = consentToCloudScan(text, consent, { cloudScanEnabled });
  if (!consented.ok) return consented;
  return scanReportConsented(consented.value, deps, options);
}
