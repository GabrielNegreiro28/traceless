import { MAX_CANDIDATES, type Candidate } from '../../domain/detection/candidates/candidateTypes';
import { verifiedFindings } from '../../domain/detection/candidates/verifiedFindings';
import type { TextChunk } from '../../domain/detection/textChunker';
import type { Finding } from '../../domain/detection/types';
import { toRawText, type RawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import { err, ok, type Result } from '../../shared/result';
import type { DisclosureCandidateFinder } from '../ports/DisclosureCandidates';
import type { DisclosureVerification } from '../ports/DisclosureVerification';

/**
 * The verify pass of a scan pipeline (Layers 2 + 3a): deterministic candidates over the whole
 * report, then one on-device verifier call per chunk that has candidates inside it.
 */

export interface VerifyPassResult {
  /** MODEL findings at the candidates' exact whole-report spans, before any post-filter. */
  readonly findings: Finding[];
  readonly retries: number;
}

/** At most this many candidates per verifier call (the verifier schema's bound). */
export const MAX_CANDIDATES_PER_CALL = MAX_CANDIDATES;

const EMPTY: VerifyPassResult = { findings: [], retries: 0 };

/** Fixed messages: never include report or model text. */
const OFF_DEVICE = createAppError('PrivacyViolation', {
  message: 'A candidate check did not run on this device; all findings were discarded.',
});
const CANCELLED = createAppError('Cancelled', { message: 'The scan was cancelled.' });

/** Candidates lying entirely inside `chunk`, in text order, capped per call. */
export function candidatesInChunk(candidates: readonly Candidate[], chunk: TextChunk): Candidate[] {
  const end = chunk.offset + chunk.text.length;
  return candidates
    .filter((c) => c.span.start >= chunk.offset && c.span.end <= end)
    .slice(0, MAX_CANDIDATES_PER_CALL);
}

async function findCandidates(
  finder: DisclosureCandidateFinder,
  text: RawText,
): Promise<Candidate[]> {
  const found = await finder.find(text);
  if (found.ok) return found.value;
  logger.warn('disclosure candidates unavailable; the verify pass adds nothing', {
    kind: found.error.kind,
  });
  return [];
}

/**
 * Runs the verify pass over `chunks` (strictly in order). A candidate finder failure only
 * skips the pass; a verifier failure, a cancellation or an off-device result fails it (and so
 * the scan, fail-closed). Candidates straddling two chunks are not verified. `onProgress`
 * gets (0, calls) once the calls are known, then (done, calls) after each verifier call.
 */
export async function runVerifyPass(
  text: RawText,
  chunks: readonly TextChunk[],
  deps: DisclosureVerification,
  isCancelled: () => boolean,
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<Result<VerifyPassResult, AppError>> {
  const candidates = await findCandidates(deps.finder, text);
  const batches = chunks.map((chunk) => candidatesInChunk(candidates, chunk));
  const total = batches.filter((b) => b.length > 0).length;
  onProgress(0, total);
  if (candidates.length === 0) return ok(EMPTY);
  let done = 0;
  const findings: Finding[] = [];
  let retries = 0;
  for (const [index, chunk] of chunks.entries()) {
    const inChunk = batches[index] ?? [];
    if (inChunk.length === 0) continue;
    if (isCancelled()) return err(CANCELLED);
    const quotes = inChunk.map((c) => c.quote);
    const verified = await deps.verifier.verify(toRawText(chunk.text), quotes);
    if (!verified.ok) return err(verified.error);
    if (verified.value.source !== 'ON_DEVICE') return err(OFF_DEVICE);
    findings.push(...verifiedFindings(inChunk, verified.value.verdicts));
    retries += verified.value.retries;
    onProgress(++done, total);
  }
  return ok({ findings, retries });
}
