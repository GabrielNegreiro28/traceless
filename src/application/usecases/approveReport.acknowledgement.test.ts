import { describe, expect, it } from 'vitest';
import { detectByRules } from '../../domain/detection/ruleDetector';
import type { Finding } from '../../domain/detection/types';
import { assessApproval } from '../../domain/review/approvalCheck';
import { applyDecisions, type ReviewDecision } from '../../domain/rewrite/rewriteApplier';
import { accept, edit, findingOf, keep, notAboutMe } from '../../domain/rewrite/rewriteTestKit';
import { toRawText } from '../../domain/text/brandedText';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { approveReport } from './approveReport';

/**
 * The outbox decides whether to show the acknowledgement checkbox with assessApproval; the
 * use case refuses with RiskNotAcknowledged. Both must agree on every review.
 */
const raw = toRawText(
  'I am the only night shift lead at Dock B. Email me at me@home.org. ' +
    'The invoices came from boss@acme.com.',
);
const [mine, accused] = detectByRules(raw) as [Finding, Finding];
const role = findingOf(raw, 'the only night shift lead', {
  category: 'ROLE_UNIQUE',
  suggestion: 'a staff member',
});
const dock = findingOf(raw, 'Dock B', { category: 'LOCATION', suggestion: 'the warehouse' });
const findings = [role, dock, mine, accused];

const SCENARIOS: readonly (readonly [string, readonly ReviewDecision[]])[] = [
  ['everything resolved', [accept(role), accept(dock), accept(mine), notAboutMe(accused)]],
  ['one location pending', [accept(role), edit(mine, ''), notAboutMe(accused)]],
  ['quasi-identifiers kept', [keep(role), keep(dock), accept(mine), notAboutMe(accused)]],
  ['quasi-identifiers pending', [accept(mine), notAboutMe(accused)]],
  ['accused email kept', [accept(role), accept(dock), accept(mine), keep(accused)]],
  ['role kept only', [keep(role), accept(dock), accept(mine), notAboutMe(accused)]],
];

function requiredFor(decisions: readonly ReviewDecision[]): boolean {
  const rewritten = applyDecisions(raw, findings, decisions);
  if (!rewritten.ok) throw new Error('fixture rewrite failed');
  return assessApproval(raw, rewritten.value, findings, decisions).acknowledgementRequired;
}

function refusedForRisk(decisions: readonly ReviewDecision[]): boolean {
  const result = approveReport(
    { text: raw, findings, decisions, acknowledgedRemainingRisk: false },
    { clock: new FakeClock(1) },
  );
  return !result.ok && result.error.kind === 'RiskNotAcknowledged';
}

describe('assessApproval agrees with approveReport', () => {
  it.each(SCENARIOS)('%s', (_name, decisions) => {
    expect(requiredFor(decisions)).toBe(refusedForRisk(decisions));
  });

  it('covers both outcomes (the comparison is not vacuous)', () => {
    const outcomes = SCENARIOS.map(([, decisions]) => requiredFor(decisions));
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });

  it('an acknowledged approval passes whenever only acknowledgement was missing', () => {
    for (const [, decisions] of SCENARIOS) {
      const result = approveReport(
        { text: raw, findings, decisions, acknowledgedRemainingRisk: true },
        { clock: new FakeClock(1) },
      );
      expect(result.ok).toBe(true);
    }
  });
});
