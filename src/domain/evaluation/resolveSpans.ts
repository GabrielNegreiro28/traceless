import { err, ok, type Result } from '../../shared/result';
import { spansOverlap } from '../detection/span';
import type { FindingCategory, TextSpan } from '../detection/types';
import type { Dataset, DatasetReport, MustNotKind } from './datasetSchema';

export type QuoteProblemCode =
  'EMPTY_QUOTE' | 'QUOTE_NOT_FOUND' | 'QUOTE_AMBIGUOUS' | 'OCCURRENCE_OUT_OF_RANGE';

export interface ResolvedGold {
  readonly quote: string;
  readonly category: FindingCategory;
  readonly span: TextSpan;
}

export interface ResolvedMustNot {
  readonly quote: string;
  readonly kind: MustNotKind;
  readonly span: TextSpan;
}

export interface ResolvedReport {
  readonly id: string;
  readonly sector: string;
  readonly split: DatasetReport['split'];
  readonly text: string;
  readonly gold: readonly ResolvedGold[];
  readonly mustNot: readonly ResolvedMustNot[];
}

export interface DatasetProblem {
  readonly reportId: string;
  readonly code: QuoteProblemCode | 'DUPLICATE_ID' | 'GOLD_OVERLAPS_MUST_NOT';
  /** Annotation path such as `gold[2]` or `mustNotFlag[0]`; never report text. */
  readonly path: string;
}

/** Start offsets of every (possibly overlapping) occurrence of `quote`. */
function findOccurrences(text: string, quote: string): number[] {
  const starts: number[] = [];
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    starts.push(at);
  }
  return starts;
}

/**
 * Exact substring match. Without `occurrence` the quote must appear exactly once;
 * with it (1-based) the Nth occurrence is used.
 */
export function resolveQuote(
  text: string,
  quote: string,
  occurrence?: number,
): Result<TextSpan, QuoteProblemCode> {
  if (quote.length === 0) return err('EMPTY_QUOTE');
  const starts = findOccurrences(text, quote);
  if (starts.length === 0) return err('QUOTE_NOT_FOUND');
  if (occurrence === undefined) {
    if (starts.length > 1) return err('QUOTE_AMBIGUOUS');
    return ok({ start: starts[0] as number, end: (starts[0] as number) + quote.length });
  }
  const start = starts[occurrence - 1];
  if (start === undefined) return err('OCCURRENCE_OUT_OF_RANGE');
  return ok({ start, end: start + quote.length });
}

function collect<A extends { quote: string; occurrence?: number | undefined }, R>(
  report: DatasetReport,
  items: readonly A[],
  pathName: string,
  build: (item: A, span: TextSpan) => R,
): { resolved: R[]; problems: DatasetProblem[] } {
  const resolved: R[] = [];
  const problems: DatasetProblem[] = [];
  items.forEach((item, index) => {
    const span = resolveQuote(report.text, item.quote, item.occurrence);
    if (span.ok) resolved.push(build(item, span.value));
    else problems.push({ reportId: report.id, code: span.error, path: `${pathName}[${index}]` });
  });
  return { resolved, problems };
}

function overlapProblems(
  reportId: string,
  gold: readonly ResolvedGold[],
  mustNot: readonly ResolvedMustNot[],
): DatasetProblem[] {
  const problems: DatasetProblem[] = [];
  gold.forEach((g, gi) => {
    mustNot.forEach((m, mi) => {
      if (spansOverlap(g.span, m.span)) {
        problems.push({
          reportId,
          code: 'GOLD_OVERLAPS_MUST_NOT',
          path: `gold[${gi}]~mustNotFlag[${mi}]`,
        });
      }
    });
  });
  return problems;
}

/** Resolves every annotation of one report, or lists what is wrong with it. */
export function resolveReport(report: DatasetReport): Result<ResolvedReport, DatasetProblem[]> {
  const gold = collect(report, report.gold, 'gold', (g, span) => ({
    quote: g.quote,
    category: g.category,
    span,
  }));
  const mustNot = collect(report, report.mustNotFlag, 'mustNotFlag', (m, span) => ({
    quote: m.quote,
    kind: m.kind,
    span,
  }));
  const problems = [
    ...gold.problems,
    ...mustNot.problems,
    ...overlapProblems(report.id, gold.resolved, mustNot.resolved),
  ];
  if (problems.length > 0) return err(problems);
  const { id, sector, split, text } = report;
  return ok({ id, sector, split, text, gold: gold.resolved, mustNot: mustNot.resolved });
}

function duplicateIdProblems(dataset: Dataset): DatasetProblem[] {
  const seen = new Set<string>();
  const problems: DatasetProblem[] = [];
  for (const report of dataset.reports) {
    if (seen.has(report.id)) {
      problems.push({ reportId: report.id, code: 'DUPLICATE_ID', path: 'id' });
    }
    seen.add(report.id);
  }
  return problems;
}

/** Pure consistency check of a parsed dataset; an empty list means it is valid. */
export function validateDataset(dataset: Dataset): DatasetProblem[] {
  const perReport = dataset.reports.flatMap((report) => {
    const resolved = resolveReport(report);
    return resolved.ok ? [] : resolved.error;
  });
  return [...duplicateIdProblems(dataset), ...perReport];
}
