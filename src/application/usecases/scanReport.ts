import { toRawText, type RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';
import type { IdentityScanner } from '../ports/IdentityScanner';
import type { ChunkScanFn } from './scanChunks';
import {
  runScanPipeline,
  type ScanPipelineSettings,
  type ScanReportOptions,
  type ScanReportResult,
} from './scanPipeline';

export type {
  ScanReportOptions,
  ScanReportResult,
  ScanStats,
  UnfilteredFindings,
} from './scanPipeline';

export interface ScanReportDeps extends ScanPipelineSettings {
  readonly scanner: IdentityScanner;
}

/**
 * The on-device detection pipeline (PLANO §3.4) over raw text: the shared pipeline
 * (scanPipeline.ts) with the on-device IdentityScanner bound to each chunk. Always
 * fail-closed: the first chunk that did not run ON_DEVICE stops the scan, discards every
 * finding and fails with PrivacyViolation. The consented cloud scan has its own use case
 * (scanReportConsented) and its own port.
 */
export async function scanReport(
  text: RawText,
  deps: ScanReportDeps,
  options: ScanReportOptions = {},
): Promise<Result<ScanReportResult, AppError>> {
  const { scanner } = deps;
  const scanChunk: ChunkScanFn = (chunk) => scanner.scan(toRawText(chunk.text));
  return runScanPipeline(text, scanChunk, { ...deps, allowCloud: false }, options);
}
