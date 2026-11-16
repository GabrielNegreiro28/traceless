import {
  sliceConsentedText,
  toRawText,
  type ConsentedRawText,
} from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';
import type { ConsentedIdentityScanner } from '../ports/ConsentedIdentityScanner';
import type { ChunkScanFn } from './scanChunks';
import {
  runScanPipeline,
  type ScanPipelineSettings,
  type ScanReportOptions,
  type ScanReportResult,
} from './scanPipeline';

export interface ScanReportConsentedDeps extends ScanPipelineSettings {
  readonly scanner: ConsentedIdentityScanner;
}

/**
 * The consented cloud scan (docs/design/fase3-product-plan.md §2b): the SAME shared pipeline
 * as the on-device scan (scanPipeline.ts: chunks, locate, post-filters, rules, merge), with
 * the consented scanner bound to each chunk. It takes ConsentedRawText, which only
 * consentToCloudScan creates, so raw text cannot reach it by type. Every chunk sent is a
 * slice of the consented text (a substring of what the reporter agreed to send). The local
 * deterministic steps read the text as RawText, the most restrictive class.
 */
export async function scanReportConsented(
  text: ConsentedRawText,
  deps: ScanReportConsentedDeps,
  options: ScanReportOptions = {},
): Promise<Result<ScanReportResult, AppError>> {
  const { scanner } = deps;
  const scanChunk: ChunkScanFn = (chunk) =>
    scanner.scan(sliceConsentedText(text, chunk.offset, chunk.offset + chunk.text.length));
  return runScanPipeline(toRawText(text), scanChunk, { ...deps, allowCloud: true }, options);
}
