import { mergeFindings } from '../../domain/detection/findingMerger';
import { applyPostFilters, type PostFilterName } from '../../domain/detection/postFilters';
import { detectByRules } from '../../domain/detection/ruleDetector';
import type { RulePack } from '../../domain/detection/rulePacks';
import { chunkText, type TextChunk } from '../../domain/detection/textChunker';
import type { Finding, TextSpan } from '../../domain/detection/types';
import type { RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { ok, type Result } from '../../shared/result';
import type { Clock } from '../ports/Clock';
import type { InferenceSourceKind } from '../ports/IdentityScanner';
import { scanChunksSequentially, type ChunkScanFn, type ModelPass } from './scanChunks';
import type { DisclosureVerification } from '../ports/DisclosureVerification';
import { runVerifyPass } from './verifyCandidatesPass';

/**
 * INTERNAL helper of the two scan use cases (scanReport on the device, scanReportConsented
 * in the cloud): chunking, locating, post-filters, rules, merging and stats live here once,
 * so the consented path can never drift from the on-device one. Callers bind the scanner.
 */

/** What both scan use cases share in their dependencies. */
export interface ScanPipelineSettings {
  readonly clock: Clock;
  /** Report characters per model call (the composition root passes MODEL_CHUNK_CHARS). */
  readonly chunkChars: number;
  /** Deterministic filters on the model findings (none by default). */
  readonly postFilters?: readonly PostFilterName[];
  /** Which deterministic rules run over the full text (default `core`, §G.3). */
  readonly rulePack?: RulePack;
  /**
   * Layers 2 + 3a: candidate phrases checked by the on-device verifier, one more call per
   * chunk with candidates (none by default). Its findings join the model findings before the
   * post-filters. Only the on-device use case binds it; RAW text never goes to the cloud.
   */
  readonly disclosure?: DisclosureVerification;
}

export interface ScanReportOptions {
  /** Called with (0, total) before the first chunk, then after each finished chunk. */
  readonly onProgress?: (done: number, total: number) => void;
  /** Polled before every chunk; when it returns true the scan stops with a Cancelled error. */
  readonly isCancelled?: () => boolean;
}

export interface ScanStats {
  readonly chunks: number;
  readonly rawModelFindings: number;
  /** Located model findings before the post-filters. */
  readonly locatedModelFindings: number;
  /** Raw model findings whose quote matched nowhere in the text (hallucinated or too short). */
  readonly unlocatedModelFindings: number;
  /** Located model findings removed by the post-filters (0 without filters). */
  readonly suppressed: number;
  readonly retries: number;
  /** Time spent in the verifier pass (candidate search + verifier calls); 0 without one. */
  readonly verifyMs: number;
  readonly durationMs: number;
}

/** The same scan before the post-filters (for the raw evaluation view). */
export interface UnfilteredFindings {
  readonly findings: Finding[];
  readonly modelFindings: Finding[];
}

export interface ScanReportResult {
  /** What ships to the reporter: rule findings merged with the post-filtered model findings. */
  readonly findings: Finding[];
  /** Post-filtered located model findings, before merging with the rule findings. */
  readonly modelFindings: Finding[];
  /** Unfiltered view of the same scan; equal to the fields above when no filter is enabled. */
  readonly raw: UnfilteredFindings;
  /** Where protected people are mentioned; empty unless `protectedMentions` ran. */
  readonly protectedSpans: TextSpan[];
  /** IN_CLOUD if any chunk ran in the cloud; ON_DEVICE otherwise (also with no chunks). */
  readonly source: InferenceSourceKind;
  readonly stats: ScanStats;
}

const NO_PROGRESS = (): void => undefined;
const NEVER_CANCELLED = (): boolean => false;

function buildResult(
  text: RawText,
  pass: ModelPass,
  settings: ScanPipelineSettings,
): Omit<ScanReportResult, 'stats'> & { readonly suppressed: number } {
  const ruleFindings = detectByRules(text, settings.rulePack);
  const postFilters = settings.postFilters ?? [];
  const filtered = applyPostFilters(text, pass.findings, pass.protectedQuotes, postFilters);
  return {
    findings: mergeFindings([...ruleFindings, ...filtered.kept]),
    modelFindings: filtered.kept,
    raw: {
      findings: mergeFindings([...ruleFindings, ...pass.findings]),
      modelFindings: pass.findings,
    },
    protectedSpans: filtered.protectedSpans,
    source: pass.source,
    suppressed: filtered.suppressed,
  };
}

/** The verify pass's outcome and how long it ran. */
interface VerifiedPass {
  readonly pass: ModelPass;
  readonly verifyMs: number;
}

/**
 * Adds the verify pass (when bound) to the scan passes' model contribution: its findings
 * already carry exact spans, so they count as raw and located model findings alike. Its
 * calls extend the progress total (chunks + verifier calls), so progress reaches the end only
 * when the last verifier call is done.
 */
async function withVerifiedCandidates(
  text: RawText,
  chunks: readonly TextChunk[],
  pass: ModelPass,
  settings: ScanPipelineSettings,
  options: ScanReportOptions,
): Promise<Result<VerifiedPass, AppError>> {
  if (settings.disclosure === undefined) return ok({ pass, verifyMs: 0 });
  const startedAt = settings.clock.now();
  const onProgress = options.onProgress ?? NO_PROGRESS;
  const verified = await runVerifyPass(
    text,
    chunks,
    settings.disclosure,
    options.isCancelled ?? NEVER_CANCELLED,
    (done, total) => onProgress(chunks.length + done, chunks.length + total),
  );
  if (!verified.ok) return verified;
  const { findings, retries } = verified.value;
  return ok({
    pass: {
      ...pass,
      findings: [...pass.findings, ...findings],
      rawModelFindings: pass.rawModelFindings + findings.length,
      retries: pass.retries + retries,
    },
    verifyMs: settings.clock.now() - startedAt,
  });
}

/**
 * Chunk-scan progress. With a verify pass bound, the total is an upper bound (chunks plus one
 * verifier call per chunk) until the verify pass knows its exact call count, so the scan
 * phase never reports completion.
 */
function scanProgress(
  chunkCount: number,
  settings: ScanPipelineSettings,
  options: ScanReportOptions,
): (done: number, total: number) => void {
  const onProgress = options.onProgress ?? NO_PROGRESS;
  if (settings.disclosure === undefined) return onProgress;
  return (done, total) => onProgress(done, total + chunkCount);
}

/**
 * Detection pipeline for one report (PLANO §3.4): the bound scanner on chunks (sequentially;
 * on-device inference is serial), quotes located per chunk and shifted to report offsets;
 * protected quotes from ALL chunks are collected first, then the enabled post-filters run
 * over the full text (so a person introduced in chunk 1 is protected in chunk 2); finally the
 * deterministic rule findings (full text) are merged in. A model failure on any chunk fails
 * the scan; there is no silent rules-only downgrade. Unless `allowCloud`, the first chunk that
 * did not run ON_DEVICE fails the scan with PrivacyViolation and discards every finding.
 * `text` is only read locally here, so it is typed RawText, the most restrictive class.
 */
export async function runScanPipeline(
  text: RawText,
  scanChunk: ChunkScanFn,
  settings: ScanPipelineSettings & { readonly allowCloud: boolean },
  options: ScanReportOptions,
): Promise<Result<ScanReportResult, AppError>> {
  const startedAt = settings.clock.now();
  const chunks = chunkText(text, settings.chunkChars);
  const pass = await scanChunksSequentially(
    {
      scanChunk,
      allowCloud: settings.allowCloud,
      onProgress: scanProgress(chunks.length, settings, options),
      isCancelled: options.isCancelled ?? NEVER_CANCELLED,
    },
    chunks,
  );
  if (!pass.ok) return pass;
  const verified = await withVerifiedCandidates(text, chunks, pass.value, settings, options);
  if (!verified.ok) return verified;
  const modelPass = verified.value.pass;
  const { suppressed, ...result } = buildResult(text, modelPass, settings);
  return ok({
    ...result,
    stats: {
      chunks: chunks.length,
      rawModelFindings: modelPass.rawModelFindings,
      locatedModelFindings: modelPass.findings.length,
      unlocatedModelFindings: modelPass.unlocated,
      suppressed,
      retries: modelPass.retries,
      verifyMs: verified.value.verifyMs,
      durationMs: settings.clock.now() - startedAt,
    },
  });
}
