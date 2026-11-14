import type { RawText } from '../text/brandedText';
import { buildFindingId } from './span';
import type { Finding, ModelFinding, TextSpan } from './types';

export interface NormalizedText {
  readonly text: string;
  /** For each normalized char: the original span it came from. */
  readonly origins: readonly TextSpan[];
}

const MIN_QUOTE_CHARS = 2;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const CHAR_MAP: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
  '…': '...',
};

/** Lowercases, folds curly quotes/dashes/ellipsis and collapses whitespace runs. */
export function normalizeWithMap(source: string): NormalizedText {
  const chars: string[] = [];
  const origins: TextSpan[] = [];
  let inSpace = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source.charAt(i);
    if (/\s/.test(ch)) {
      if (inSpace) origins[origins.length - 1] = { start: origins.at(-1)!.start, end: i + 1 };
      else {
        chars.push(' ');
        origins.push({ start: i, end: i + 1 });
        inSpace = true;
      }
      continue;
    }
    inSpace = false;
    for (const out of (CHAR_MAP[ch] ?? ch).toLowerCase()) {
      chars.push(out);
      origins.push({ start: i, end: i + 1 });
    }
  }
  return { text: chars.join(''), origins };
}

/** Start offsets of every non-overlapping occurrence of `needle` in `haystack`. */
export function findAllOccurrences(haystack: string, needle: string): number[] {
  const starts: number[] = [];
  if (needle.length === 0) return starts;
  let from = haystack.indexOf(needle);
  while (from !== -1) {
    starts.push(from);
    from = haystack.indexOf(needle, from + needle.length);
  }
  return starts;
}

/** The normalized search needle for a quote, or null when it is too short to trust. */
function toNeedle(quote: string): string | null {
  const stripped = normalizeWithMap(quote).text.trim().replace(TRAILING_PUNCTUATION, '').trim();
  return stripped.replace(/\s/g, '').length >= MIN_QUOTE_CHARS ? stripped : null;
}

/** True when the match is not glued to a neighbouring letter/digit of the original text. */
export function hasWordBoundaries(text: string, span: TextSpan): boolean {
  const first = text.slice(span.start, span.start + 2);
  const last = text.slice(Math.max(0, span.end - 2), span.end);
  const before = text.slice(Math.max(0, span.start - 2), span.start);
  const after = text.slice(span.end, span.end + 2);
  const startsWord = /^[\p{L}\p{N}]/u.test(first);
  const endsWord = /[\p{L}\p{N}]$/u.test(last);
  const glueBefore = startsWord && /[\p{L}\p{N}]$/u.test(before);
  const glueAfter = endsWord && /^[\p{L}\p{N}]/u.test(after);
  return !glueBefore && !glueAfter;
}

function tolerantSpans(text: string, normalized: NormalizedText, needle: string): TextSpan[] {
  return findAllOccurrences(normalized.text, needle)
    .map((start) => ({
      start: normalized.origins[start]!.start,
      end: normalized.origins[start + needle.length - 1]!.end,
    }))
    .filter((span) => hasWordBoundaries(text, span));
}

/**
 * Every tolerant, word-bounded occurrence of `quote` in `text` (the matching rules of
 * {@link locateModelFindingsWithStats}); empty when the quote is too short or absent.
 * Pass `normalized` when locating many quotes in the same text.
 */
export function locateQuote(
  text: string,
  quote: string,
  normalized: NormalizedText = normalizeWithMap(text),
): TextSpan[] {
  const needle = toNeedle(quote);
  return needle === null ? [] : tolerantSpans(text, normalized, needle);
}

function toFinding(text: string, span: TextSpan, source: ModelFinding): Finding {
  return {
    id: buildFindingId('MODEL', span, source.category),
    span,
    quote: text.slice(span.start, span.end),
    category: source.category,
    reason: source.reason,
    suggestion: source.suggestion,
    origin: 'MODEL',
  };
}

export interface LocatedModelFindings {
  readonly findings: Finding[];
  /** Raw model findings whose quote resolved to zero spans (hallucinated or too short). */
  readonly unlocated: number;
}

/**
 * Turns model quotes into located findings.
 *
 * Matching is always tolerant (case, whitespace runs, curly quotes, dashes, ellipsis,
 * trailing `.,;:!?` on the quote), so exact and variant spellings are all found and
 * mapped back to original offsets. A match is kept only if it is not glued to a
 * neighbouring letter/digit (`ward` does not match inside `toward`); the check applies
 * on a side only when the quote itself starts/ends with a letter or digit. Quotes with
 * fewer than 2 non-space characters, and quotes absent from the text (hallucinations),
 * are dropped and counted in `unlocated`. Every occurrence becomes its own finding;
 * duplicate ids collapse.
 */
export function locateModelFindingsWithStats(
  text: RawText,
  findings: ModelFinding[],
): LocatedModelFindings {
  const normalized = normalizeWithMap(text);
  const byId = new Map<string, Finding>();
  let unlocated = 0;
  for (const found of findings) {
    const spans = locateQuote(text, found.quote, normalized);
    if (spans.length === 0) unlocated += 1;
    for (const span of spans) {
      const finding = toFinding(text, span, found);
      if (!byId.has(finding.id)) byId.set(finding.id, finding);
    }
  }
  return { findings: [...byId.values()], unlocated };
}

/** Located findings only; see {@link locateModelFindingsWithStats}. */
export function locateModelFindings(text: RawText, findings: ModelFinding[]): Finding[] {
  return locateModelFindingsWithStats(text, findings).findings;
}
