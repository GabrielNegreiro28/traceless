/**
 * The organized view of an APPROVED report (docs/design/fase3-product-plan.md §1 item 5):
 * a category from a closed list, a one-line summary, and when and where it happened. It only
 * restates the approved text; only the category is stored with the report.
 */

export const REPORT_CATEGORIES = [
  'harassment',
  'fraud',
  'safety',
  'discrimination',
  'retaliation',
  'other',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const MAX_SUMMARY_CHARS = 200;
export const MAX_DETAIL_CHARS = 120;

export interface StructuredReport {
  readonly category: ReportCategory;
  /** One line, at most MAX_SUMMARY_CHARS characters. */
  readonly summary: string;
  /** When it happened, as written in the approved text; null when not stated. */
  readonly when: string | null;
  /** Where it happened, as written in the approved text; null when not stated. */
  readonly where: string | null;
}

export function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === 'string' && (REPORT_CATEGORIES as readonly string[]).includes(value);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A detail survives only when its words appear in the approved text (case-insensitive). */
function groundedOrNull(detail: string | null, source: string): string | null {
  if (detail === null) return null;
  const needle = normalize(detail);
  return needle !== '' && normalize(source).includes(needle) ? detail : null;
}

/**
 * Drops `when`/`where` values that are not quoted from the approved text, so the model can
 * never add a date or place the reporter did not approve. The summary is free text and is
 * checked by the reporter on screen.
 */
export function keepGroundedDetails(report: StructuredReport, source: string): StructuredReport {
  return {
    ...report,
    when: groundedOrNull(report.when, source),
    where: groundedOrNull(report.where, source),
  };
}
