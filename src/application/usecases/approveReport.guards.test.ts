import { describe, expect, it } from 'vitest';
import { detectByRules } from '../../domain/detection/ruleDetector';
import type { Finding } from '../../domain/detection/types';
import type { ReviewDecision } from '../../domain/rewrite/rewriteApplier';
import { accept, findingOf, keep, notAboutMe } from '../../domain/rewrite/rewriteTestKit';
import { toRawText, type RawText } from '../../domain/text/brandedText';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { approveReport } from './approveReport';

function approve(
  text: RawText,
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
  acknowledgedRemainingRisk = true,
) {
  return approveReport(
    { text, findings, decisions, acknowledgedRemainingRisk },
    { clock: new FakeClock(7) },
  );
}

describe('approveReport: partial coverage of a direct identifier', () => {
  const raw = toRawText('write to john@acme.com now');
  const [email] = detectByRules(raw) as [Finding];
  const john = findingOf(raw, 'john', { category: 'PERSONAL_TRAIT', suggestion: 'someone' });
  const domain = findingOf(raw, 'acme.com', { suggestion: '[company]' });

  it('blocks a pending email next to a NOT_ABOUT_ME name, even when acknowledged', () => {
    expect(approve(raw, [john, email], [notAboutMe(john)])).toMatchObject({
      ok: false,
      error: { kind: 'DirectIdentifierRemains', count: 1 },
    });
  });

  it.each([
    ['name', john],
    ['domain', domain],
  ])('blocks an email mangled by accepting only its %s', (_name, part) => {
    expect(approve(raw, [part, email], [accept(part)])).toMatchObject({
      ok: false,
      error: { kind: 'DirectIdentifierRemains' },
    });
  });
});

describe('approveReport: stale review', () => {
  it('rejects a NOT_ABOUT_ME finding that no longer matches the text', () => {
    const someone: Finding = {
      ...findingOf('about someone here', 'someone'),
      span: { start: 6, end: 13 },
    };
    const result = approve(toRawText('about a@b.com here..'), [someone], [notAboutMe(someone)]);
    expect(result).toMatchObject({ ok: false, error: { kind: 'Unknown' } });
  });
});

describe('approveReport: empty report and risk level', () => {
  it('refuses a report with no text left after the rewrite', () => {
    const raw = toRawText('  me@home.org  ');
    const [email] = detectByRules(raw) as [Finding];
    expect(approve(raw, [email], [accept(email)])).toMatchObject({
      ok: false,
      error: { kind: 'EmptyReport' },
    });
  });

  it('reports the actual (LOW) level when a kept direct identifier needs acknowledgement', () => {
    const raw = toRawText('Ask boss@acme.com, ok.');
    const style = findingOf(raw, 'Ask boss@acme.com, ok', { category: 'WRITING_STYLE' });
    const result = approve(raw, [style], [keep(style)], false);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'RiskNotAcknowledged', level: 'LOW' },
    });
    expect(approve(raw, [style], [keep(style)], true).ok).toBe(true);
  });
});
