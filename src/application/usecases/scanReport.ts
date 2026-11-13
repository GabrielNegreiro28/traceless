import { MODEL_CHUNK_CHARS } from '../../ai/prompts/identityScan.v1';
import { mergeFindings } from '../../domain/detection/findingMerger';
import { detectByRules } from '../../domain/detection/ruleDetector';
import { locateModelFindings } from '../../domain/detection/spanLocator';
import { chunkText, shiftFindings, type TextChunk } from '../../domain/detection/textChunker';
import type { Finding } from '../../domain/detection/types';
import { toRawText, type RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { Clock } from '../ports/Clock';
import type { IdentityScanner, InferenceSourceKind } from '../ports/IdentityScanner';

export interface ScanReportDeps {
  readonly scanner: IdentityScanner;
  readonly clock: Clock;
  /** Report characters per model call; defaults to MODEL_CHUNK_CHARS. */
  readonly chunkChars?: number;
}

export interface ScanReportOptions {
  /** Called with (0, total) before the first chunk, then after each finished chunk. */
  readonly onProgress?: (done: number, total: number) => void;
}

export interface ScanStats {
  readonly chunks: number;
  readonly rawModelFindings: number;
  readonly locatedModelFindings: number;
  readonly retries: number;
  readonly durationMs: number;
}

export interface ScanReportResult {
  readonly findings: Finding[];
  /** IN_CLOUD if any chunk ran in the cloud; ON_DEVICE otherwise (also with no chunks). */
  readonly source: InferenceSourceKind;
  readonly stats: ScanStats;
}

interface ModelPass {
  readonly findings: Finding[];
  readonly source: InferenceSourceKind;
  readonly rawModelFindings: number;
  readonly retries: number;
}

async function scanChunk(
  scanner: IdentityScanner,
  chunk: TextChunk,
): Promise<Result<ModelPass, AppError>> {
  const chunkText = toRawText(chunk.text);
  const scanned = await scanner.scan(chunkText);
  if (!scanned.ok) return scanned;
  const { findings, source, retries } = scanned.value;
  const located = shiftFindings(locateModelFindings(chunkText, findings), chunk.offset);
  return ok({ findings: located, source, rawModelFindings: findings.length, retries });
}

/** Scans chunks strictly one after another; the first failing chunk fails the whole pass. */
async function scanChunksSequentially(
  scanner: IdentityScanner,
  chunks: readonly TextChunk[],
  onProgress: (done: number, total: number) => void,
): Promise<Result<ModelPass, AppError>> {
  const passes: ModelPass[] = [];
  onProgress(0, chunks.length);
  for (const [index, chunk] of chunks.entries()) {
    const pass = await scanChunk(scanner, chunk);
    if (!pass.ok) return err(pass.error);
    passes.push(pass.value);
    onProgress(index + 1, chunks.length);
  }
  return ok(combinePasses(passes));
}

function combinePasses(passes: readonly ModelPass[]): ModelPass {
  return {
    findings: passes.flatMap((p) => p.findings),
    source: passes.some((p) => p.source === 'IN_CLOUD') ? 'IN_CLOUD' : 'ON_DEVICE',
    rawModelFindings: passes.reduce((sum, p) => sum + p.rawModelFindings, 0),
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
  const chunks = chunkText(text, deps.chunkChars ?? MODEL_CHUNK_CHARS);
  const pass = await scanChunksSequentially(
    deps.scanner,
    chunks,
    options.onProgress ?? NO_PROGRESS,
  );
  if (!pass.ok) return pass;
  const { findings, source, rawModelFindings, retries } = pass.value;
  return ok({
    findings: mergeFindings([...ruleFindings, ...findings]),
    source,
    stats: {
      chunks: chunks.length,
      rawModelFindings,
      locatedModelFindings: findings.length,
      retries,
      durationMs: deps.clock.now() - startedAt,
    },
  });
}
