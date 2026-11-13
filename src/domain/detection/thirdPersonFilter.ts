import { hasFirstPersonPlural, hasFirstPersonSingular } from './firstPerson';
import type { Finding } from './types';

/** A quote that opens (after any punctuation) with the word He, She or They. */
const THIRD_PERSON_START = /^[^\p{L}]*(?:he|she|they)\b/iu;

export interface ThirdPersonResult {
  readonly kept: Finding[];
  readonly suppressed: Finding[];
}

/**
 * True for a MODEL finding about someone else's actions: it starts with He/She/They and
 * has no first-person token, singular or plural (a plural one may describe the writer's
 * team: "They put only two of us on the desk"). RULE findings are never matched.
 */
export function isThirdPersonFinding(finding: Finding): boolean {
  return (
    finding.origin === 'MODEL' &&
    THIRD_PERSON_START.test(finding.quote) &&
    !hasFirstPersonSingular(finding.quote) &&
    !hasFirstPersonPlural(finding.quote)
  );
}

/**
 * Drops third-person MODEL findings (docs/design/fase2-gate-iteration.md §B.3).
 * "She moved me to nights", "They split us into two teams" and "I sit next to her
 * office" are kept. Order is preserved.
 */
export function filterThirdPerson(findings: readonly Finding[]): ThirdPersonResult {
  const kept: Finding[] = [];
  const suppressed: Finding[] = [];
  for (const finding of findings) {
    (isThirdPersonFinding(finding) ? suppressed : kept).push(finding);
  }
  return { kept, suppressed };
}
