/**
 * Pure helpers for scripts/eval-inspect.mjs. Standalone on purpose (no src imports): Node
 * runs this file directly. The matching rule mirrors src/domain/evaluation/matching.ts:
 * overlap / min(length) >= 0.5. Output holds synthetic dataset text only.
 */

export const MATCH_THRESHOLD = 0.5;

export interface Span {
  readonly start: number;
  readonly end: number;
}
export interface GoldItem {
  readonly quote: string;
  readonly category: string;
  readonly occurrence?: number;
}
export interface MustNotItem {
  readonly quote: string;
  readonly kind: string;
  readonly occurrence?: number;
}
export interface DatasetReportLite {
  readonly id: string;
  readonly text: string;
  readonly gold: readonly GoldItem[];
  readonly mustNotFlag: readonly MustNotItem[];
}
export interface FindingLite {
  readonly span: Span;
  readonly category: string;
  readonly origin: string;
}
export interface ResolvedItem {
  readonly quote: string;
  readonly label: string;
  readonly span: Span;
}

export function overlapRatio(a: Span, b: Span): number {
  const shared = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  return shared <= 0 || shorter <= 0 ? 0 : shared / shorter;
}

export function spansMatch(a: Span, b: Span): boolean {
  return overlapRatio(a, b) >= MATCH_THRESHOLD;
}

/** Span of the Nth (1-based, default first) occurrence of `quote`; null if absent. */
export function locateQuote(text: string, quote: string, occurrence = 1): Span | null {
  if (quote.length === 0) return null;
  let at = text.indexOf(quote);
  for (let n = 1; at !== -1 && n < occurrence; n++) at = text.indexOf(quote, at + 1);
  return at === -1 ? null : { start: at, end: at + quote.length };
}

interface Annotation {
  readonly quote: string;
  readonly occurrence?: number;
}

function resolveItems(
  text: string,
  items: readonly Annotation[],
  labels: readonly string[],
): ResolvedItem[] {
  return items.flatMap((item, index) => {
    const span = locateQuote(text, item.quote, item.occurrence);
    return span === null ? [] : [{ quote: item.quote, label: labels[index] ?? '', span }];
  });
}

export function resolveGold(report: DatasetReportLite): ResolvedItem[] {
  return resolveItems(
    report.text,
    report.gold,
    report.gold.map((g) => g.category),
  );
}

export function resolveMustNot(report: DatasetReportLite): ResolvedItem[] {
  return resolveItems(
    report.text,
    report.mustNotFlag,
    report.mustNotFlag.map((m) => m.kind),
  );
}

/** GOLD-hit, ACCUSED, INCIDENT_FACT, OTHER_PERSON (joined with "+" if several) or unannotated. */
export function labelFinding(
  finding: FindingLite,
  gold: readonly ResolvedItem[],
  mustNot: readonly ResolvedItem[],
): string {
  const labels = new Set<string>();
  for (const item of mustNot) if (spansMatch(finding.span, item.span)) labels.add(item.label);
  if (gold.some((item) => spansMatch(finding.span, item.span))) labels.add('GOLD-hit');
  return labels.size === 0 ? 'unannotated' : [...labels].join('+');
}

export function missedGold(
  findings: readonly FindingLite[],
  gold: readonly ResolvedItem[],
): ResolvedItem[] {
  return gold.filter((item) => !findings.some((f) => spansMatch(f.span, item.span)));
}

export interface RecallTally {
  total: number;
  hit: number;
}

/** Adds one report-run to a per-category tally (only successful scans should be added). */
export function addRecall(
  tally: Record<string, RecallTally>,
  gold: readonly ResolvedItem[],
  missed: readonly ResolvedItem[],
): void {
  for (const item of gold) {
    const entry = (tally[item.label] ??= { total: 0, hit: 0 });
    entry.total += 1;
    if (!missed.includes(item)) entry.hit += 1;
  }
}

function pct(t: RecallTally): string {
  return t.total === 0 ? 'n/a' : `${((100 * t.hit) / t.total).toFixed(1)}%`;
}

export function recallTable(tally: Readonly<Record<string, RecallTally>>): string[] {
  const rows = Object.entries(tally).sort(([a], [b]) => a.localeCompare(b));
  const total = rows.reduce((s, [, t]) => s + t.total, 0);
  const hit = rows.reduce((s, [, t]) => s + t.hit, 0);
  const line = (name: string, t: RecallTally) =>
    `${name.padEnd(22)} ${String(t.hit).padStart(3)}/${String(t.total).padEnd(3)} ${pct(t)}`;
  return [...rows.map(([name, t]) => line(name, t)), line('ALL', { total, hit })];
}

export function quoteOf(text: string, span: Span): string {
  return text.slice(span.start, span.end).replaceAll(/\s+/g, ' ');
}

export function formatFinding(text: string, finding: FindingLite, label: string): string {
  const quote = quoteOf(text, finding.span);
  return `  [${label}] ${finding.category} (${finding.origin}) "${quote}"`;
}

/** Mean and max of the verifier-pass time over the given per-report counts. */
export interface VerifyTiming {
  readonly mean: number;
  readonly max: number;
  readonly reports: number;
}

/**
 * Verifier-pass timing over scanned reports that recorded `verifyMs` (result files saved
 * before per-pass timing have none: returns null).
 */
export function verifyTiming(
  counts: readonly { readonly verifyMs?: number | null }[],
): VerifyTiming | null {
  const times = counts.flatMap((c) => (typeof c.verifyMs === 'number' ? [c.verifyMs] : []));
  if (times.length === 0) return null;
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return { mean: Math.round(mean), max: Math.max(...times), reports: times.length };
}
