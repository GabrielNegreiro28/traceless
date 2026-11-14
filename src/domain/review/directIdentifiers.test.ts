import { describe, expect, it } from 'vitest';
import { detectByRules } from '../detection/ruleDetector';
import { mergeFindings } from '../detection/findingMerger';
import type { Finding } from '../detection/types';
import { applyDecisions, type ReviewDecision } from '../rewrite/rewriteApplier';
import { accept, edit, findingOf, keep, notAboutMe } from '../rewrite/rewriteTestKit';
import { toRawText } from '../text/brandedText';
import { assessDirectIdentifiers } from './directIdentifiers';

const text = toRawText('Reach me at me@home.org. The fraud came from boss@acme.com.');
const [mine, accused] = detectByRules(text) as [Finding, Finding];

function assess(findings: readonly Finding[], decisions: readonly ReviewDecision[]) {
  const rewritten = applyDecisions(text, findings, decisions);
  if (!rewritten.ok) throw new Error('unexpected error');
  return assessDirectIdentifiers(text, rewritten.value, findings, decisions);
}

describe('assessDirectIdentifiers', () => {
  it('counts every pending direct identifier as undecided', () => {
    expect(assess([mine, accused], [])).toEqual({ undecided: 2, keptAtRisk: 0 });
  });

  it('accepts rewritten identifiers and the accused email marked NOT_ABOUT_ME', () => {
    expect(assess([mine, accused], [accept(mine), notAboutMe(accused)])).toEqual({
      undecided: 0,
      keptAtRisk: 0,
    });
  });

  it('allows a KEPT_RISK identifier but reports it as kept at risk', () => {
    expect(assess([mine, accused], [accept(mine), keep(accused)])).toEqual({
      undecided: 0,
      keptAtRisk: 1,
    });
  });

  it('covers an identifier through a decided finding that contains it', () => {
    const sentence = findingOf(text, 'came from boss@acme.com', { category: 'LOCATION' });
    expect(assess([mine, sentence], [accept(mine), notAboutMe(sentence)]).undecided).toBe(0);
  });

  it('blocks a new identifier typed into an edit', () => {
    expect(assess([mine, accused], [edit(mine, 'x@y.io'), notAboutMe(accused)]).undecided).toBe(1);
  });

  it('a kept string does not excuse a second, undecided copy of it', () => {
    const twice = toRawText('Mail a@b.co or a@b.co');
    const [one, two] = detectByRules(twice) as [Finding, Finding];
    const status = assessDirectIdentifiers(twice, twice, [one, two], [notAboutMe(one)]);
    expect(status.undecided).toBe(1);
  });

  it('ignores a kept identifier that an overlapping accepted span removed', () => {
    const wide = findingOf(text, 'The fraud came from boss@acme.com', { suggestion: 'A fraud' });
    const status = assess([mine, accused, wide], [accept(mine), keep(accused), accept(wide)]);
    expect(status).toEqual({ undecided: 0, keptAtRisk: 0 });
  });
});

describe('assessDirectIdentifiers: partial coverage never excuses an identifier', () => {
  const raw = toRawText('write to john@acme.com now');
  const [email] = detectByRules(raw) as [Finding];
  const john = findingOf(raw, 'john', { category: 'PERSONAL_TRAIT', suggestion: 'someone' });
  const domain = findingOf(raw, 'acme.com', { suggestion: '[company]' });

  function status(findings: readonly Finding[], decisions: readonly ReviewDecision[]) {
    const rewritten = applyDecisions(raw, findings, decisions);
    if (!rewritten.ok) throw new Error('unexpected error');
    return assessDirectIdentifiers(raw, rewritten.value, findings, decisions);
  }

  it('a NOT_ABOUT_ME finding that only overlaps the email leaves it undecided', () => {
    expect(status([john, email], [notAboutMe(john)]).undecided).toBe(1);
  });

  it.each([
    ['the name part', john],
    ['the domain part', domain],
  ])('accepting %s mangles the email, which stays undecided', (_name, part) => {
    expect(status([part, email], [accept(part), notAboutMe(email)]).undecided).toBeGreaterThan(0);
  });

  it('a pending MODEL direct identifier blocks', () => {
    const badge = findingOf(raw, 'now', { category: 'DIRECT_IDENTIFIER' });
    expect(status([email, badge], [accept(email)]).undecided).toBe(1);
  });

  it('a MODEL direct identifier overlapping a pending rule one is counted once', () => {
    const model = findingOf(raw, 'john@acme.com now', { category: 'DIRECT_IDENTIFIER' });
    expect(status([email, model], []).undecided).toBe(1);
  });

  it('the PENDING_BY_USER marker counts as pending', () => {
    const marker: ReviewDecision = { findingId: email.id, action: 'PENDING_BY_USER' };
    expect(status([email], [marker]).undecided).toBe(1);
  });
});

describe('assessDirectIdentifiers: a model identifier relabeled RULE by the merger', () => {
  const raw = toRawText('Please contact Jane Roe, jane.roe@example.com, at the depot.');
  const [email] = detectByRules(raw) as [Finding];
  const contact = findingOf(raw, 'Jane Roe, jane.roe@example.com', {
    category: 'DIRECT_IDENTIFIER',
    suggestion: 'a colleague',
  });
  const place = findingOf(raw, 'jane.roe@example.com, at the depot', { suggestion: 'at work' });

  function status(findings: readonly Finding[], decisions: readonly ReviewDecision[]) {
    const rewritten = applyDecisions(raw, findings, decisions);
    if (!rewritten.ok) throw new Error('unexpected error');
    return assessDirectIdentifiers(raw, rewritten.value, findings, decisions);
  }

  it('still blocks while it is pending, even with origin RULE', () => {
    const merged = mergeFindings([email, contact, place]);
    const relabeled = merged.find((f) => f.category === 'DIRECT_IDENTIFIER');
    expect(relabeled).toMatchObject({ origin: 'RULE', quote: contact.quote });
    expect(status(merged, [accept(place)]).undecided).toBe(1);
  });

  it('no longer blocks once it is accepted', () => {
    const merged = mergeFindings([email, contact, place]);
    const relabeled = merged.find((f) => f.category === 'DIRECT_IDENTIFIER') as Finding;
    expect(status(merged, [accept(place), accept(relabeled)]).undecided).toBe(0);
  });

  it('counts a pure pending RULE identifier exactly once', () => {
    expect(status([email], []).undecided).toBe(1);
    expect(status([email, place], []).undecided).toBe(1);
  });

  it('a pure RULE identifier kept through a containing finding is not counted again', () => {
    expect(status([email, place], [keep(place)])).toEqual({ undecided: 0, keptAtRisk: 1 });
  });
});
