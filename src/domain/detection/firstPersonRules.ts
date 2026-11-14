import type { RawText } from '../text/brandedText';
import { hasFirstPersonPlural, hasFirstPersonSingular } from './firstPerson';
import {
  FIRST_PERSON_FAMILIES,
  FIRST_PERSON_FAMILY_IDS,
  type FamilyPattern,
  type FirstPersonFamily,
  type FirstPersonFamilyId,
} from './firstPersonFamilies';
import { isInReportedSpeech } from './firstPersonSpeech';
import { buildFindingId } from './span';
import { hasWordBoundaries } from './spanLocator';
import type { Finding, TextSpan } from './types';

/**
 * First-person rule pack (docs/design/fase2-gate-iteration.md §G.3): deterministic, origin
 * RULE findings for plain first-person phrases the model tends to miss ("I'm the only night
 * porter", "I work nights", "since I came back from maternity leave"). Pure.
 */

/**
 * Families switched on in the `core+firstPerson` rule pack. A family that fails the dev
 * precision guard is removed from this list whole, never patched.
 */
export const FIRST_PERSON_PACK: readonly FirstPersonFamilyId[] = FIRST_PERSON_FAMILY_IDS;

export const MIN_SPAN_WORDS = 2;
export const MAX_SPAN_WORDS = 8;
const AFTER_CHARS = 40;

/** A first-person finding and the family that produced it (for per-family measurement). */
export interface FirstPersonMatch {
  readonly family: FirstPersonFamilyId;
  readonly finding: Finding;
}

/** Characters that end a clause; an anchor must sit between the last one and the span's end. */
const CLAUSE_BREAK = /[.!?;:,\n]/;
/** "a.m."/"p.m." dots are part of a clock time, not a sentence end. */
const CLOCK_DOTS = /\b([ap])\.m\./gi;
const SENTENCE_BREAK = /[!?;\n]|\.(?:\s|$)/;

function wordCount(quote: string): number {
  return quote.trim().split(/\s+/).length;
}

function crossesSentence(quote: string): boolean {
  return SENTENCE_BREAK.test(quote.replace(CLOCK_DOTS, '$1m'));
}

function clauseStart(text: string, offset: number): number {
  let at = offset;
  while (at > 0 && !CLAUSE_BREAK.test(text.charAt(at - 1))) at -= 1;
  return at;
}

/** I/me/my/we/us/our (and their forms) inside the span or earlier in the same clause. */
function hasAnchorInClause(text: string, span: TextSpan): boolean {
  const clause = text.slice(clauseStart(text, span.start), span.end);
  return hasFirstPersonSingular(clause) || hasFirstPersonPlural(clause);
}

/** The generic span contract every family match must meet. */
function isValidSpan(text: string, span: TextSpan): boolean {
  const quote = text.slice(span.start, span.end);
  const words = wordCount(quote);
  return (
    words >= MIN_SPAN_WORDS &&
    words <= MAX_SPAN_WORDS &&
    !crossesSentence(quote) &&
    hasWordBoundaries(text, span) &&
    hasAnchorInClause(text, span)
  );
}

function toFinding(
  text: string,
  span: TextSpan,
  family: FirstPersonFamily,
  pattern: FamilyPattern,
): Finding {
  return {
    id: buildFindingId('RULE', span, family.category),
    span,
    quote: text.slice(span.start, span.end),
    category: family.category,
    reason: family.reason,
    suggestion: pattern.suggestion,
    origin: 'RULE',
  };
}

function matchPattern(
  text: string,
  family: FirstPersonFamily,
  pattern: FamilyPattern,
): FirstPersonMatch[] {
  const matches: FirstPersonMatch[] = [];
  for (const m of text.matchAll(new RegExp(pattern.source, `${pattern.flags}d`))) {
    const range = m.indices?.groups?.['span'];
    if (range === undefined) continue;
    const span: TextSpan = { start: range[0], end: range[1] };
    // The match starts at its first-person anchor ("when/after/since" just before it).
    if (!isValidSpan(text, span) || isInReportedSpeech(text, m.index)) continue;
    const after = text.slice(span.end, span.end + AFTER_CHARS);
    if (pattern.accept?.({ groups: m.groups ?? {}, after }) === false) continue;
    matches.push({ family: family.id, finding: toFinding(text, span, family, pattern) });
  }
  return matches;
}

/** Every match of the given families (default: the pack), ordered by position then family. */
export function detectFirstPersonMatches(
  text: string,
  families: readonly FirstPersonFamilyId[] = FIRST_PERSON_PACK,
): FirstPersonMatch[] {
  return families
    .flatMap((id) => {
      const family = FIRST_PERSON_FAMILIES[id];
      return family.patterns.flatMap((pattern) => matchPattern(text, family, pattern));
    })
    .sort(
      (a, b) =>
        a.finding.span.start - b.finding.span.start || a.finding.span.end - b.finding.span.end,
    );
}

/** The findings of the enabled first-person families (the `core+firstPerson` addition). */
export function detectFirstPerson(text: RawText): Finding[] {
  return detectFirstPersonMatches(text).map((m) => m.finding);
}
