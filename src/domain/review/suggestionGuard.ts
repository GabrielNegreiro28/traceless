import type { Finding } from '../detection/types';
import { applyDecisions } from '../rewrite/rewriteApplier';
import type { RawText } from '../text/brandedText';
import { countUnmatched, directRules } from './directIdentifiers';

/**
 * Suggestions that would sign the report again (pure). A model suggestion such as "a
 * night-shift worker" for the sign-off "the tired trainer on the night shift" is itself a
 * self-description after "Thanks for listening,": accepting it would put a NEW direct
 * identifier in the final text, which approval rightly blocks, yet no card shows it. Such a
 * suggestion is dropped (null = remove the detail), so an accepted suggestion can never
 * create a direct identifier the reporter has no card for.
 */

function hasSuggestion(finding: Finding): boolean {
  return finding.suggestion !== null && finding.suggestion.trim() !== '';
}

/** True when accepting this one finding adds a direct identifier the text did not have. */
function introducesDirectIdentifier(
  text: RawText,
  finding: Finding,
  before: readonly string[],
): boolean {
  const accepted = applyDecisions(text, [finding], [{ findingId: finding.id, action: 'ACCEPTED' }]);
  if (!accepted.ok) return false;
  return countUnmatched(directRules(accepted.value), before) > 0;
}

/**
 * The findings with every suggestion that would introduce a direct identifier (checked on
 * its own, against the rules approval re-runs) replaced by null. Order and ids are kept.
 */
export function guardSuggestions(text: RawText, findings: readonly Finding[]): Finding[] {
  const before = directRules(text).map((f) => f.quote);
  return findings.map((finding) =>
    hasSuggestion(finding) && introducesDirectIdentifier(text, finding, before)
      ? { ...finding, suggestion: null }
      : finding,
  );
}
