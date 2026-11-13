import { mergeFindings } from '../../domain/detection/findingMerger';
import { applyPostFilters, type PostFilterName } from '../../domain/detection/postFilters';
import { detectByRules } from '../../domain/detection/ruleDetector';
import { chunkText } from '../../domain/detection/textChunker';
import type { Finding, TextSpan } from '../../domain/detection/types';
import type { RawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { ok, type Result } from '../../shared/result';
import type { Clock } from '../ports/Clock';
import type { IdentityScanner, InferenceSourceKind } from '../ports/IdentityScanner';
import { scanChunksSequentially, type ModelPass } from './scanChunks';

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
  /** Deterministic filters on the model findings (none by default). */
  readonly postFilters?: readonly PostFilterName[];
}

export interface ScanReportOptions {
  /** Called with (0, total) before the first chunk, then after each finished chunk. */
  readonly onProgress?: (done: number, total: number) => void;
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

function buildResult(
  text: RawText,
  pass: ModelPass,
  postFilters: readonly PostFilterName[],
): Omit<ScanReportResult, 'stats'> & { readonly suppressed: number } {
  const ruleFindings = detectByRules(text);
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

/**
 * Detection pipeline for one report (PLANO §3.4): the model on chunks (sequentially;
 * on-device inference is serial), quotes located per chunk and shifted to report
 * offsets; protected quotes from ALL chunks are collected first, then the enabled
 * post-filters run over the full text (so a person introduced in chunk 1 is protected in
 * chunk 2); finally the deterministic rule findings (full text) are merged in. A model
 * failure on any chunk fails the scan; there is no silent rules-only downgrade.
 */
export async function scanReport(
  text: RawText,
  deps: ScanReportDeps,
  options: ScanReportOptions = {},
): Promise<Result<ScanReportResult, AppError>> {
  const startedAt = deps.clock.now();
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
  const { suppressed, ...result } = buildResult(text, pass.value, deps.postFilters ?? []);
  return ok({
    ...result,
    stats: {
      chunks: chunks.length,
      rawModelFindings: pass.value.rawModelFindings,
      locatedModelFindings: pass.value.findings.length,
      unlocatedModelFindings: pass.value.unlocated,
      suppressed,
      retries: pass.value.retries,
      durationMs: deps.clock.now() - startedAt,
    },
  });
}
