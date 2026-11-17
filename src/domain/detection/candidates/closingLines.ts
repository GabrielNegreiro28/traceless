import type { RawCandidate } from './candidateTypes';

/** Sign-offs and contact lines sit in the last lines of a report ("Regards, R.T."). */
const CLOSING_LINE_COUNT = 2;
const MAX_CLOSING_WORDS = 8;
/** A short "Label: value" line anywhere ("Contact: …", "Staff ID: …"). */
const LABEL_LINE = /^[A-Z][A-Za-z #.'-]{1,30}:\s*\S/;

interface Line {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function nonEmptyLines(text: string): Line[] {
  return Array.from(text.matchAll(/[^\r\n]+/g), (m) => ({
    start: m.index,
    end: m.index + m[0].length,
    text: m[0],
  })).filter((line) => line.text.trim() !== '');
}

function wordCount(line: string): number {
  return line.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Short closing lines and "Label: value" lines: where writers sign off or leave contact
 * details, usually without any first-person grammar. Pure; spans are whole lines.
 */
export function closingLines(text: string): RawCandidate[] {
  const lines = nonEmptyLines(text);
  return lines
    .filter((line, i) => {
      const short = wordCount(line.text) <= MAX_CLOSING_WORDS;
      const isLast = i >= lines.length - CLOSING_LINE_COUNT && i > 0;
      return short && (isLast || LABEL_LINE.test(line.text));
    })
    .map((line) => ({ span: { start: line.start, end: line.end }, kind: 'CLOSING_LINE' as const }));
}
