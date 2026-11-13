import type { Finding } from '../detection/types';
import { toRawText, type RawText } from '../text/brandedText';
import type { AppError } from '../../shared/appError';
import { ok, type Result } from '../../shared/result';
import { clusterEdits, planEdits, type EditCluster } from './editPlan';
import { joinAroundRemoval } from './removalJoin';
import type { ReviewDecision } from './reviewDecision';

export type { ReviewAction, ReviewChoice, ReviewDecision } from './reviewDecision';

const REMOVED = Symbol('removed');
type Piece = string | typeof REMOVED;
const HSPACE_ONLY = /^[ \t]*$/;

/** A blank replacement (empty or only whitespace) removes the span. */
function toPiece(replacement: string): Piece {
  return replacement.trim() === '' ? REMOVED : replacement;
}

/**
 * Cuts the text into kept gaps and replacements, walking the clusters from the end to
 * the start so every earlier span offset is still valid when it is used.
 */
function toPieces(text: string, clusters: readonly EditCluster[]): Piece[] {
  const pieces: Piece[] = [];
  let cursor = text.length;
  for (let i = clusters.length - 1; i >= 0; i--) {
    const cluster = clusters[i]!;
    pieces.push(text.slice(cluster.span.end, cursor), toPiece(cluster.replacement));
    cursor = cluster.span.start;
  }
  pieces.push(text.slice(0, cursor));
  return pieces.reverse();
}

/**
 * Concatenates the pieces; at each removal the surrounding text is joined by
 * `joinAroundRemoval`. Whitespace-only gaps between removals are absorbed, so removing
 * two neighbouring details leaves a single clean join.
 */
function joinPieces(pieces: readonly Piece[]): string {
  let out = '';
  let pending = false;
  for (const piece of pieces) {
    if (piece === REMOVED) {
      pending = true;
      continue;
    }
    if (pending && HSPACE_ONLY.test(piece)) continue;
    out = pending ? joinAroundRemoval(out, piece) : out + piece;
    pending = false;
  }
  return pending ? joinAroundRemoval(out, '') : out;
}

/**
 * Applies the reporter's review decisions to the report text (pure).
 *
 * - ACCEPTED replaces the span with the finding's suggestion; a null suggestion removes it.
 * - EDITED replaces the span with `replacement`; a blank replacement removes it.
 * - KEPT_RISK, NOT_ABOUT_ME (or no decision) leave the span as written.
 *
 * Overlapping ACCEPTED/EDITED spans are merged into their union, which takes the replacement
 * of the earliest-starting (then longest) finding; see `clusterEdits`. Removals are
 * joined cleanly; see `joinAroundRemoval`. Fails (no partial output) on an unknown
 * finding id, a duplicate decision, an EDITED without replacement or a stale finding.
 */
export function applyDecisions(
  text: RawText,
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): Result<RawText, AppError> {
  const plan = planEdits(text, findings, decisions);
  if (!plan.ok) return plan;
  if (plan.value.length === 0) return ok(text);
  return ok(toRawText(joinPieces(toPieces(text, clusterEdits(plan.value)))));
}
