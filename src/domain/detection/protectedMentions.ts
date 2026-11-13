import type { RawText } from '../text/brandedText';
import { hasFirstPersonSingular } from './firstPerson';
import { extractNameTokens, findTokenSpans, leadingRun } from './nameTokens';
import { mergeSpans, spanLength } from './span';
import { locateQuote, normalizeWithMap } from './spanLocator';
import type { Finding, TextSpan } from './types';

/**
 * What the model marked as people NOT to flag (docs/design/fase2-gate-iteration.md §B.3).
 * Raw report text: lives in memory for one scan only, never logged or persisted.
 */
export interface ProtectedTerms {
  /** The full protected quotes, trimmed and de-duplicated. */
  readonly phrases: readonly string[];
  /** Their person-name tokens (see extractNameTokens), de-duplicated. */
  readonly names: readonly string[];
}

export interface SuppressionResult {
  readonly kept: Finding[];
  readonly suppressed: Finding[];
  /** Merged, sorted spans of every protected phrase and name occurrence ("Kept" chips). */
  readonly protectedSpans: TextSpan[];
}

/** Share of a finding one protected-phrase occurrence must cover to suppress it. */
const MIN_COVERAGE = 0.5;

/**
 * Protected phrases and their name tokens. A quote that speaks in the first person
 * singular ("my name is…", "I am the only…") describes the writer, so it is ignored
 * entirely: a mislabelled writer detail must never shield anything (safety rule).
 */
export function buildProtectedTerms(quotes: readonly string[]): ProtectedTerms {
  const usable = quotes.map((q) => q.trim()).filter((q) => q !== '' && !hasFirstPersonSingular(q));
  const phrases = [...new Set(usable)];
  const names = [...new Set(phrases.flatMap(extractNameTokens))];
  return { phrases, names };
}

function phraseOccurrences(text: string, phrases: readonly string[]): TextSpan[] {
  const normalized = normalizeWithMap(text);
  return phrases.flatMap((phrase) => locateQuote(text, phrase, normalized));
}

function overlapLength(a: TextSpan, b: TextSpan): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/**
 * True when the finding opens with a protected person: its leading capitalised run
 * (after an honorific) is non-empty and made only of protected name tokens. One
 * unprotected capitalised token ("Tom Alvarez") or a place/department word ("Jordan
 * Street") keeps it; place words are never name tokens, so `every` covers both.
 */
function startsWithProtectedName(quote: string, names: readonly string[]): boolean {
  const run = leadingRun(quote);
  return run.length > 0 && run.every((token) => names.includes(token));
}

/**
 * Suppress a MODEL finding when one protected-phrase occurrence covers >= 50% of it, or
 * when it opens with a protected name ("Wade had…", "Mr. Wade knows…"); a name elsewhere
 * in the finding does not count. Never a RULE finding, and never a finding in the first
 * person singular (safety rules).
 *
 * Known limitations (docs/design/fase2-gate-iteration.md §B.3): a writer finding that
 * opens with a surname or first name shared with a protected person is suppressed
 * (protected "Dr. Patel" vs "Patel, the only nurse on the ward"; protected "Supervisor
 * Lena Ortiz" vs "Lena and the porter are the only two"). Rare, and the writer's
 * first-person sentences are always kept.
 */
function isProtected(
  finding: Finding,
  phrases: readonly TextSpan[],
  terms: ProtectedTerms,
): boolean {
  if (finding.origin !== 'MODEL' || hasFirstPersonSingular(finding.quote)) return false;
  const needed = spanLength(finding.span) * MIN_COVERAGE;
  if (phrases.some((o) => overlapLength(o, finding.span) >= needed)) return true;
  return startsWithProtectedName(finding.quote, terms.names);
}

/**
 * Deterministic protected-mentions filter over the FULL report text, so a person named
 * in one chunk is protected in every chunk. Order of `findings` is preserved.
 */
export function suppressProtected(
  text: RawText,
  findings: readonly Finding[],
  terms: ProtectedTerms,
): SuppressionResult {
  const phrases = phraseOccurrences(text, terms.phrases);
  const names = terms.names.flatMap((name) => findTokenSpans(text, name));
  const kept: Finding[] = [];
  const suppressed: Finding[] = [];
  for (const finding of findings) {
    (isProtected(finding, phrases, terms) ? suppressed : kept).push(finding);
  }
  return { kept, suppressed, protectedSpans: mergeSpans([...phrases, ...names]) };
}
