import type { RawText } from '../text/brandedText';
import { buildProtectedTerms, suppressProtected } from './protectedMentions';
import { filterThirdPerson } from './thirdPersonFilter';
import type { Finding, TextSpan } from './types';

/** Deterministic filters that may run on the located model findings, in this order. */
export const POST_FILTERS = ['protectedMentions', 'thirdPerson'] as const;

export type PostFilterName = (typeof POST_FILTERS)[number];

export interface PostFilterOutcome {
  /** Model findings that survived every enabled filter, in input order. */
  readonly kept: Finding[];
  /** How many model findings the filters removed. */
  readonly suppressed: number;
  /** Protected-term spans; empty unless `protectedMentions` ran. */
  readonly protectedSpans: TextSpan[];
}

/**
 * Applies the enabled post-filters to the model findings of the whole report. Rule
 * findings must not be passed in (and would never be suppressed anyway). With no
 * filters enabled this is the identity.
 */
export function applyPostFilters(
  text: RawText,
  modelFindings: readonly Finding[],
  protectedQuotes: readonly string[],
  filters: readonly PostFilterName[],
): PostFilterOutcome {
  let kept = [...modelFindings];
  let protectedSpans: TextSpan[] = [];
  if (filters.includes('protectedMentions')) {
    const result = suppressProtected(text, kept, buildProtectedTerms(protectedQuotes));
    kept = result.kept;
    protectedSpans = result.protectedSpans;
  }
  if (filters.includes('thirdPerson')) kept = filterThirdPerson(kept).kept;
  return { kept, suppressed: modelFindings.length - kept.length, protectedSpans };
}
