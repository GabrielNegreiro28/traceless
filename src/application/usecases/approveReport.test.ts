import { assertType, describe, expect, expectTypeOf, it } from 'vitest';
import { detectByRules } from '../../domain/detection/ruleDetector';
import type { Finding } from '../../domain/detection/types';
import type { ReviewDecision } from '../../domain/rewrite/rewriteApplier';
import { accept, edit, findingOf, keep, notAboutMe } from '../../domain/rewrite/rewriteTestKit';
import { toRawText, type SanitizedText } from '../../domain/text/brandedText';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { approveReport } from './approveReport';

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

function approve(decisions: readonly ReviewDecision[], acknowledgedRemainingRisk = false) {
  return approveReport(
    { text: raw, findings, decisions, acknowledgedRemainingRisk },
    { clock: new FakeClock(1_700_000_000_000) },
  );
}

describe('approveReport: success', () => {
  it('returns the rewritten text, the residual risk and the injected time', () => {
    const result = approve([accept(role), accept(dock), accept(mine), notAboutMe(accused)]);
    expect(result).toEqual({
      ok: true,
      value: {
        text: 'I am a staff member at the warehouse. Email me at. The invoices came from boss@acme.com.',
        remainingRisk: expect.objectContaining({ level: 'NONE' }) as unknown,
        approvedAt: 1_700_000_000_000,
      },
    });
  });

  it('approves a LOW residual risk without acknowledgement', () => {
    const result = approve([accept(role), edit(mine, ''), notAboutMe(accused)]);
    expect(result.ok && result.value.remainingRisk.level).toBe('LOW');
  });
});

describe('approveReport: direct identifiers', () => {
  it('blocks an undecided direct identifier, reporting only the count', () => {
    const result = approve([accept(role), accept(dock), notAboutMe(accused)], true);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'DirectIdentifierRemains', count: 1 }) as unknown,
    });
    expect(result.ok ? '' : result.error.message).not.toMatch(/@/);
  });

  it('blocks a direct identifier typed into an edit, even when acknowledged', () => {
    const decisions = [accept(role), accept(dock), edit(mine, 'new@mail.io'), notAboutMe(accused)];
    expect(approve(decisions, true)).toMatchObject({
      ok: false,
      error: { kind: 'DirectIdentifierRemains', count: 1 },
    });
  });

  it('requires acknowledgement for a KEPT_RISK direct identifier', () => {
    const decisions = [accept(role), accept(dock), accept(mine), keep(accused)];
    expect(approve(decisions)).toMatchObject({ ok: false, error: { kind: 'RiskNotAcknowledged' } });
    expect(approve(decisions, true).ok).toBe(true);
  });
});

describe('approveReport: residual risk', () => {
  const kept = [keep(role), keep(dock), accept(mine), notAboutMe(accused)];

  it('refuses MEDIUM/HIGH residual risk without acknowledgement', () => {
    expect(approve(kept)).toMatchObject({
      ok: false,
      error: { kind: 'RiskNotAcknowledged', level: 'MEDIUM' },
    });
  });

  it('pending quasi-identifiers count like KEPT_RISK ones', () => {
    expect(approve([accept(mine), notAboutMe(accused)])).toMatchObject({
      ok: false,
      error: { kind: 'RiskNotAcknowledged' },
    });
  });

  it('approves the same risk once acknowledged', () => {
    const result = approve(kept, true);
    expect(result.ok && result.value.remainingRisk.level).toBe('MEDIUM');
  });

  it('propagates rewrite errors unchanged', () => {
    const result = approve([{ findingId: 'ghost', action: 'ACCEPTED' }], true);
    expect(result).toMatchObject({ ok: false, error: { kind: 'Unknown' } });
  });
});

// Compile-time guarantees, checked by `npm run typecheck`.
describe('approveReport (type level)', () => {
  it('produces SanitizedText', () => {
    const result = approve([accept(role), accept(dock), accept(mine), notAboutMe(accused)]);
    if (!result.ok) throw new Error('expected approval');
    expectTypeOf(result.value.text).toEqualTypeOf<SanitizedText>();
    assertType<SanitizedText>(result.value.text);
  });

  it('does not accept RawText where SanitizedText is required', () => {
    // @ts-expect-error RawText must go through approveReport() first
    assertType<SanitizedText>(raw);
  });
});
