import { locateModelFindingsWithStats } from '../../domain/detection/spanLocator';
import { shiftFindings, type TextChunk } from '../../domain/detection/textChunker';
import type { Finding } from '../../domain/detection/types';
import { toRawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { IdentityScanner, InferenceSourceKind } from '../ports/IdentityScanner';

/** The model's contribution for some chunks: located findings plus protected quotes. */
export interface ModelPass {
  /** Located model findings in whole-report offsets, before any post-filter. */
  readonly findings: Finding[];
  /** Union of every chunk's protected quotes (raw text: never logged or persisted). */
  readonly protectedQuotes: string[];
  readonly source: InferenceSourceKind;
  readonly rawModelFindings: number;
  readonly unlocated: number;
  readonly retries: number;
}

export interface ChunkScanContext {
  readonly scanner: IdentityScanner;
  readonly allowCloud: boolean;
  readonly onProgress: (done: number, total: number) => void;
}

/** Fixed message: never includes report or model text. */
const OFF_DEVICE_CHUNK = createAppError('PrivacyViolation', {
  message: 'A report chunk was not scanned on this device; all findings were discarded.',
});

async function scanChunk(
  scanner: IdentityScanner,
  chunk: TextChunk,
): Promise<Result<ModelPass, AppError>> {
  const rawChunk = toRawText(chunk.text);
  const scanned = await scanner.scan(rawChunk);
  if (!scanned.ok) return scanned;
  const { findings, protectedQuotes, source, retries } = scanned.value;
  const found = locateModelFindingsWithStats(rawChunk, findings);
  return ok({
    findings: shiftFindings(found.findings, chunk.offset),
    protectedQuotes: [...protectedQuotes],
    source,
    rawModelFindings: findings.length,
    unlocated: found.unlocated,
    retries,
  });
}

function combinePasses(passes: readonly ModelPass[]): ModelPass {
  return {
    findings: passes.flatMap((p) => p.findings),
    protectedQuotes: [...new Set(passes.flatMap((p) => p.protectedQuotes))],
    source: passes.some((p) => p.source === 'IN_CLOUD') ? 'IN_CLOUD' : 'ON_DEVICE',
    rawModelFindings: passes.reduce((sum, p) => sum + p.rawModelFindings, 0),
    unlocated: passes.reduce((sum, p) => sum + p.unlocated, 0),
    retries: passes.reduce((sum, p) => sum + p.retries, 0),
  };
}

/**
 * Scans chunks strictly one after another. The first failing chunk fails the whole
 * pass, and so does the first off-device chunk unless the cloud is allowed.
 */
export async function scanChunksSequentially(
  context: ChunkScanContext,
  chunks: readonly TextChunk[],
): Promise<Result<ModelPass, AppError>> {
  const passes: ModelPass[] = [];
  context.onProgress(0, chunks.length);
  for (const [index, chunk] of chunks.entries()) {
    const pass = await scanChunk(context.scanner, chunk);
    if (!pass.ok) return err(pass.error);
    if (!context.allowCloud && pass.value.source !== 'ON_DEVICE') return err(OFF_DEVICE_CHUNK);
    passes.push(pass.value);
    context.onProgress(index + 1, chunks.length);
  }
  return ok(combinePasses(passes));
}
