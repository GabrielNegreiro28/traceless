import { describe, expect, it } from 'vitest';
import { mergeFindings } from '../detection/findingMerger';
import { detectByRules } from '../detection/ruleDetector';
import { buildFindingId } from '../detection/span';
import type { Finding, FindingCategory } from '../detection/types';
import { SAMPLE_REPORT } from '../report/sampleReport';
import { applyDecisions } from '../rewrite/rewriteApplier';
import { toRawText } from '../text/brandedText';
import { assessDirectIdentifiers } from './directIdentifiers';
import { guardSuggestions } from './suggestionGuard';

const TEXT = toRawText(SAMPLE_REPORT);
const SIGN_OFF = 'the tired trainer on the night shift';

function modelFinding(
  quote: string,
  suggestion: string | null,
  category: FindingCategory = 'ROLE_UNIQUE',
): Finding {
  const start = TEXT.lastIndexOf(quote);
  const span = { start, end: start + quote.length };
  const id = buildFindingId('MODEL', span, category);
  return { id, span, quote, category, reason: 'r', suggestion, origin: 'MODEL' };
}

/** The review the owner did: every card accepted. */
function acceptAll(findings: readonly Finding[]) {
  const decisions = findings.map((f) => ({ findingId: f.id, action: 'ACCEPTED' as const }));
  const rewritten = applyDecisions(TEXT, findings, decisions);
  if (!rewritten.ok) throw new Error('apply failed');
  const status = assessDirectIdentifiers(TEXT, rewritten.value, findings, decisions);
  return { text: rewritten.value, undecided: status.undecided };
}

describe('guardSuggestions on the sample report', () => {
  const merged = (extra: Finding) => mergeFindings([...detectByRules(TEXT), extra]);

  it.each<FindingCategory>(['ROLE_UNIQUE', 'SCHEDULE', 'DIRECT_IDENTIFIER'])(
    'reproduces the block: accepting "a night-shift worker" for the %s sign-off signs the report again',
    (category) => {
      const findings = merged(modelFinding(SIGN_OFF, 'a night-shift worker', category));
      expect(acceptAll(findings).undecided).toBe(1);
    },
  );

  it.each<FindingCategory>(['ROLE_UNIQUE', 'SCHEDULE', 'DIRECT_IDENTIFIER'])(
    'drops a %s suggestion that would sign the report again, so accepting every card approves',
    (category) => {
      const findings = guardSuggestions(
        TEXT,
        merged(modelFinding(SIGN_OFF, 'an employee on the late shift', category)),
      );
      expect(findings.every((f) => f.quote !== SIGN_OFF || f.suggestion === null)).toBe(true);
      const result = acceptAll(findings);
      expect(result.undecided).toBe(0);
      expect(result.text).not.toContain('shift\n');
      expect(result.text.trimEnd().endsWith('Thanks for listening,')).toBe(true);
    },
  );

  it('keeps suggestions that add no direct identifier, in order and with their ids', () => {
    const input = merged(modelFinding(SIGN_OFF, 'a member of the team'));
    const findings = guardSuggestions(TEXT, input);
    expect(findings).toEqual(input);
    expect(acceptAll(findings).undecided).toBe(0);
  });

  it('drops a suggestion that types a direct identifier into the body', () => {
    const finding = modelFinding('forklift trainer', 'trainer (j.doe@example.com)');
    const [guarded] = guardSuggestions(TEXT, [finding]);
    expect(guarded).toEqual({ ...finding, suggestion: null });
  });

  it('still blocks an undecided sign-off (fail closed)', () => {
    const findings = guardSuggestions(TEXT, mergeFindings(detectByRules(TEXT)));
    const status = assessDirectIdentifiers(TEXT, TEXT, findings, []);
    expect(status.undecided).toBe(1);
  });
});
