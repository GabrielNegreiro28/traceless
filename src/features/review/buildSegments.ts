import type { Finding, TextSpan } from '../../domain/detection/types';

/**
 * One piece of the report text. `findingIds` lists every finding that covers the piece,
 * narrowest first (the first one is the piece's primary finding); it is empty for plain text.
 */
export interface Segment {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly findingIds: readonly string[];
}

interface Range {
  readonly id: string;
  readonly start: number;
  readonly end: number;
}

const isHigh = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

/** True when `index` falls between the two halves of a surrogate pair. */
function splitsPair(text: string, index: number): boolean {
  return (
    index > 0 &&
    index < text.length &&
    isHigh(text.charCodeAt(index - 1)) &&
    isLow(text.charCodeAt(index))
  );
}

/** Clamps a span to the text and widens it so it never cuts an emoji in half. */
function toRange(text: string, id: string, span: TextSpan): Range | null {
  let start = Math.max(0, Math.min(span.start, text.length));
  let end = Math.max(0, Math.min(span.end, text.length));
  if (splitsPair(text, start)) start -= 1;
  if (splitsPair(text, end)) end += 1;
  return start < end ? { id, start, end } : null;
}

function byNarrowest(a: Range, b: Range): number {
  return a.end - a.start - (b.end - b.start) || a.start - b.start || a.id.localeCompare(b.id);
}

function boundariesOf(ranges: readonly Range[], length: number): number[] {
  const points = new Set<number>([0, length]);
  for (const range of ranges) {
    points.add(range.start);
    points.add(range.end);
  }
  return [...points].sort((a, b) => a - b);
}

/**
 * Splits `text` at every finding boundary into consecutive, non-overlapping segments that
 * together cover the whole text, so overlapping findings still render as plain, valid
 * markup. A segment inside several findings lists all their ids (narrowest first).
 * Spans outside the text are clamped; empty spans are ignored; boundaries never split a
 * surrogate pair.
 */
export function buildSegments(text: string, findings: readonly Finding[]): Segment[] {
  const ranges = findings.flatMap((f) => toRange(text, f.id, f.span) ?? []);
  const points = boundariesOf(ranges, text.length);
  const segments: Segment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const start = points[i] ?? 0;
    const end = points[i + 1] ?? text.length;
    const covering = ranges.filter((r) => r.start <= start && end <= r.end).sort(byNarrowest);
    segments.push({
      start,
      end,
      text: text.slice(start, end),
      findingIds: covering.map((r) => r.id),
    });
  }
  return segments;
}
