import { spanLength } from '../detection/span';
import type { Finding, TextSpan } from '../detection/types';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import { changesText, type ReviewDecision } from './reviewDecision';

/** One text change requested by an ACCEPTED or EDITED decision. */
export interface PlannedEdit {
  readonly findingId: string;
  readonly span: TextSpan;
  /** Empty string = remove the span. */
  readonly replacement: string;
  /** True for EDITED: the reporter typed this replacement. */
  readonly typed: boolean;
}

/** Overlapping edits merged into one change over the union of their spans. */
export interface EditCluster {
  readonly span: TextSpan;
  readonly replacement: string;
  /** The finding whose replacement is used (see clusterEdits). */
  readonly primaryId: string;
}

/** Fixed messages: never include report text. */
const invalid = (message: string): AppError => createAppError('Unknown', { message });
const UNKNOWN_FINDING = invalid('A review decision refers to a finding that does not exist.');
const DUPLICATE_DECISION = invalid('A finding has more than one review decision.');
const MISSING_REPLACEMENT = invalid('An EDITED decision has no replacement text.');
const STALE_FINDING = invalid('A finding no longer matches the report text; scan it again.');

function replacementFor(finding: Finding, decision: ReviewDecision): string | undefined {
  return decision.action === 'ACCEPTED' ? (finding.suggestion ?? '') : decision.replacement;
}

function matchesText(text: string, finding: Finding): boolean {
  const { start, end } = finding.span;
  return start >= 0 && start < end && text.slice(start, end) === finding.quote;
}

/** Every decided finding must still match the text, whatever the decision. */
function toPlannedEdit(
  text: string,
  finding: Finding | undefined,
  decision: ReviewDecision,
): Result<PlannedEdit | null, AppError> {
  if (!finding) return err(UNKNOWN_FINDING);
  if (!matchesText(text, finding)) return err(STALE_FINDING);
  if (!changesText(decision)) return ok(null);
  const replacement = replacementFor(finding, decision);
  if (replacement === undefined) return err(MISSING_REPLACEMENT);
  const typed = decision.action === 'EDITED';
  return ok({ findingId: finding.id, span: finding.span, replacement, typed });
}

/**
 * Checks every decision against the findings and the text, and returns the edits to make.
 * Fails on an unknown finding id, two decisions for one finding, an EDITED without a
 * replacement, or a decided finding whose quote no longer matches the text (stale review).
 */
export function planEdits(
  text: string,
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): Result<PlannedEdit[], AppError> {
  const byId = new Map(findings.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const edits: PlannedEdit[] = [];
  for (const decision of decisions) {
    if (seen.has(decision.findingId)) return err(DUPLICATE_DECISION);
    seen.add(decision.findingId);
    const edit = toPlannedEdit(text, byId.get(decision.findingId), decision);
    if (!edit.ok) return edit;
    if (edit.value) edits.push(edit.value);
  }
  return ok(edits);
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Primary order inside a cluster: typed (EDITED) first, then earliest, longest, id. */
function comparePrimary(a: PlannedEdit, b: PlannedEdit): number {
  if (a.typed !== b.typed) return a.typed ? -1 : 1;
  return (
    a.span.start - b.span.start ||
    spanLength(b.span) - spanLength(a.span) ||
    compareText(a.findingId, b.findingId)
  );
}

/** Sweeps the edits by start and groups those that share at least one character. */
function groupOverlapping(edits: readonly PlannedEdit[]): PlannedEdit[][] {
  const groups: { end: number; members: PlannedEdit[] }[] = [];
  const sorted = [...edits].sort((a, b) => a.span.start - b.span.start || b.span.end - a.span.end);
  for (const edit of sorted) {
    const last = groups.at(-1);
    if (last && edit.span.start < last.end) {
      last.members.push(edit);
      last.end = Math.max(last.end, edit.span.end);
    } else {
      groups.push({ end: edit.span.end, members: [edit] });
    }
  }
  return groups.map((g) => g.members);
}

function toCluster(members: readonly PlannedEdit[]): EditCluster {
  const primary = [...members].sort(comparePrimary)[0]!;
  const start = Math.min(...members.map((m) => m.span.start));
  const end = Math.max(...members.map((m) => m.span.end));
  return { span: { start, end }, replacement: primary.replacement, primaryId: primary.findingId };
}

/**
 * Overlap policy: edits whose spans share at least one character are merged into one
 * cluster covering the union of their spans. The cluster takes the replacement of its
 * primary edit: an EDITED decision (text the reporter typed) wins over ACCEPTED, then
 * the earliest start, then the longest span, then the smallest id. Adjacent spans (one
 * ends where the next starts) stay separate. The result is sorted by start and never
 * overlaps, so applying it cannot garble the text, whatever the input order.
 */
export function clusterEdits(edits: readonly PlannedEdit[]): EditCluster[] {
  return groupOverlapping(edits).map(toCluster);
}
