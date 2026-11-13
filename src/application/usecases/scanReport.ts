import { mergeFindings } from '../../domain/detection/findingMerger';
import { detectByRules } from '../../domain/detection/ruleDetector';
import { locateModelFindingsWithStats } from '../../domain/detection/spanLocator';
import { chunkText, shiftFindings, type TextChunk } from '../../domain/detection/textChunker';
import type { Finding } from '../../domain/detection/types';
import { toRawText, type RawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { Clock } from '../ports/Clock';
import type { IdentityScanner, InferenceSourceKind } from '../ports/IdentityScanner';

export interface ScanReportDeps {
  readonly scanner: IdentityScanner;
  readonly clock: Clock;
  /** Report characters per model call (the composition root passes MODEL_CHUNK_CHARS). */
  readonly chunkChars: number;
  /**
   * Defense in depth: unless true, the first chunk that did not run ON_DEVICE stops the
   * scan, discards every finding and fails with PrivacyViolation. Only the consented
   * cloud scan (explicit reporter consent) sets this.
   */
  readonly allowCloud?: boolean;
}

export interface ScanReportOptions {
  /** Called with (0, total) before the first chunk, then after each finished chunk. */
  readonly onProgress?: (done: number, total: number) => void;
}

export interface ScanStats {
  readonly chunks: number;
  readonly rawModelFindings: number;
  readonly locatedModelFindings: number;
  /** Raw model findings whose quote matched nowhere in the text (hallucinated or too short). */
  readonly unlocatedModelFindings: number;
  readonly retries: number;
  readonly durationMs: number;
}

export interface ScanReportResult {
  readonly findings: Finding[];
  /** Located model findings before merging with the rule findings (for evaluation). */
  readonly modelFindings: Finding[];
  /** IN_CLOUD if any chunk ran in the cloud; ON_DEVICE otherwise (also with no chunks). */
  readonly source: InferenceSourceKind;
  readonly stats: ScanStats;
}

interface ModelPass {
  readonly findings: Finding[];
  readonly source: InferenceSourceKind;
  readonly rawModelFindings: number;
  readonly unlocated: number;
  readonly retries: number;
}

interface ChunkScanContext {
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
  const { findings, source, retries } = scanned.value;
  const found = locateModelFindingsWithStats(rawChunk, findings);
  const located = shiftFindings(found.findings, chunk.offset);
  return ok({
    findings: located,
    source,
    rawModelFindings: findings.length,
    unlocated: found.unlocated,
    retries,
  });
}

/**
 * Scans chunks strictly one after another. The first failing chunk fails the whole
 * pass, and so does the first off-device chunk unless the cloud is allowed.
 */
async function scanChunksSequentially(
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

function combinePasses(passes: readonly ModelPass[]): ModelPass {
  return {
    findings: passes.flatMap((p) => p.findings),
    source: passes.some((p) => p.source === 'IN_CLOUD') ? 'IN_CLOUD' : 'ON_DEVICE',
    rawModelFindings: passes.reduce((sum, p) => sum + p.rawModelFindings, 0),
    unlocated: passes.reduce((sum, p) => sum + p.unlocated, 0),
    retries: passes.reduce((sum, p) => sum + p.retries, 0),
  };
}

const NO_PROGRESS = (): void => undefined;

/**
 * Detection pipeline for one report (PLANO §3.4): deterministic rules on the full text,
 * then the model on chunks (sequentially; on-device inference is serial), quotes located
 * per chunk and shifted to report offsets, then everything merged. A model failure on
 * any chunk fails the scan; there is no silent rules-only downgrade.
 */
export async function scanReport(
  text: RawText,
  deps: ScanReportDeps,
  options: ScanReportOptions = {},
): Promise<Result<ScanReportResult, AppError>> {
  const startedAt = deps.clock.now();
  const ruleFindings = detectByRules(text);
  const chunks = chunkText(text, deps.chunkChars);
  const pass = await scanChunksSequentially(
    {
      scanner: deps.scanner,
      allowCloud: deps.allowCloud === true,
      onProgress: options.onProgress ?? NO_PROGRESS,
    },
    chunks,
  );
  if (!pass.ok) return pass;
  const { findings, source, rawModelFindings, unlocated, retries } = pass.value;
  return ok({
    findings: mergeFindings([...ruleFindings, ...findings]),
    modelFindings: findings,
    source,
    stats: {
      chunks: chunks.length,
      rawModelFindings,
      locatedModelFindings: findings.length,
      unlocatedModelFindings: unlocated,
      retries,
      durationMs: deps.clock.now() - startedAt,
    },
  });
}
