import { buildFindingId, shiftSpan } from './span';
import type { Finding } from './types';

export interface TextChunk {
  readonly text: string;
  /** UTF-16 offset of `text` inside the original report. */
  readonly offset: number;
}

interface Range {
  start: number;
  end: number;
}

/** Smallest allowed limit: 2 so a surrogate pair (emoji) always fits in a chunk. */
export const MIN_CHUNK_CHARS = 2;

const PARAGRAPH = /\S[\s\S]*?(?=\r?\n[ \t]*\r?\n|$)/g;
/** Finer separators tried, in order, on a paragraph that is too long. */
const SEPARATORS: readonly RegExp[] = [/\n/g, /[.!?]+["')\]]*\s+/g];

/**
 * Clamps the limit instead of failing: NaN and values below MIN_CHUNK_CHARS become
 * MIN_CHUNK_CHARS, fractions are floored and Infinity means "never split".
 */
export function normalizeMaxChars(maxChars: number): number {
  if (Number.isNaN(maxChars)) return MIN_CHUNK_CHARS;
  if (maxChars === Infinity) return Number.MAX_SAFE_INTEGER;
  return Math.max(MIN_CHUNK_CHARS, Math.floor(maxChars));
}

function paragraphRanges(text: string): Range[] {
  return Array.from(text.matchAll(PARAGRAPH), (m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
}

/** Splits a range right after each separator match (separator stays with the piece). */
function splitAfter(text: string, range: Range, separator: RegExp): Range[] {
  const pieces: Range[] = [];
  let start = range.start;
  for (const m of text.slice(range.start, range.end).matchAll(new RegExp(separator))) {
    const end = range.start + m.index + m[0].length;
    pieces.push({ start, end });
    start = end;
  }
  if (start < range.end) pieces.push({ start, end: range.end });
  return pieces;
}

function isSurrogatePairBoundary(text: string, index: number): boolean {
  const high = text.charCodeAt(index - 1);
  const low = text.charCodeAt(index);
  return high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff;
}

/** Chooses where a hard cut lands: after the last whitespace, else not inside a pair. */
function hardCutEnd(text: string, start: number, limit: number): number {
  for (let i = limit - 1; i > start; i--) {
    if (/\s/.test(text.charAt(i))) return i + 1;
  }
  return isSurrogatePairBoundary(text, limit) ? limit - 1 : limit;
}

function hardSplit(text: string, range: Range, max: number): Range[] {
  const parts: Range[] = [];
  let start = range.start;
  while (start < range.end) {
    const limit = Math.min(start + max, range.end);
    const end = limit === range.end ? limit : hardCutEnd(text, start, limit);
    if (text.slice(start, end).trim() !== '') parts.push({ start, end });
    start = end;
  }
  return parts;
}

/** Splits an oversized range by newline, then sentence, then whitespace/hard cuts. */
function splitRange(text: string, range: Range, max: number, level = 0): Range[] {
  if (range.end - range.start <= max) return [range];
  const separator = SEPARATORS[level];
  if (separator === undefined) return hardSplit(text, range, max);
  return splitAfter(text, range, separator).flatMap((p) => splitRange(text, p, max, level + 1));
}

/** Greedily merges adjacent ranges while the covered stretch stays within `max`. */
function packRanges(ranges: readonly Range[], max: number): Range[] {
  const packed: Range[] = [];
  let current: Range | null = null;
  for (const range of ranges) {
    if (current && range.end - current.start <= max) {
      current.end = range.end;
    } else {
      current = { ...range };
      packed.push(current);
    }
  }
  return packed;
}

/**
 * Splits a report into chunks of at most `maxChars` characters (clamped, see
 * `normalizeMaxChars`). Paragraphs (blank-line separated, LF or CRLF) are packed
 * greedily; an oversized paragraph is split at line breaks, then sentence ends, then
 * whitespace, and as a last resort mid-word without cutting a surrogate pair.
 * Chunk text is always an exact slice of the input
 * (`text.slice(offset, offset + chunk.text.length) === chunk.text`), chunks are never
 * whitespace-only, and no non-whitespace character is lost.
 */
export function chunkText(text: string, maxChars: number): TextChunk[] {
  const max = normalizeMaxChars(maxChars);
  const units = paragraphRanges(text).flatMap((p) => splitRange(text, p, max));
  return packRanges(units, max).map((r) => ({ text: text.slice(r.start, r.end), offset: r.start }));
}

/** Re-bases chunk-local findings to whole-report offsets (ids are rebuilt to match). */
export function shiftFindings(findings: Finding[], offset: number): Finding[] {
  return findings.map((finding) => {
    const span = shiftSpan(finding.span, offset);
    return { ...finding, span, id: buildFindingId(finding.origin, span, finding.category) };
  });
}
