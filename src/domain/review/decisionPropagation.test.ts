import { describe, expect, it } from 'vitest';
import { findingOf, keep } from '../rewrite/rewriteTestKit';
import { propagateDecision, undoDecision } from './decisionPropagation';

const text = 'Mr. Alvarez yelled. Later mr.  ALVAREZ left. Mr. Alvarez-Cruz stayed.';
const first = findingOf(text, 'Mr. Alvarez', { category: 'PERSONAL_TRAIT' });
const second = findingOf(text, 'mr.  ALVAREZ');
const longer = findingOf(text, 'Mr. Alvarez-Cruz');
const findings = [first, second, longer];

describe('propagateDecision', () => {
  it('copies the choice to identical quotes (case and whitespace insensitive)', () => {
    const decisions = propagateDecision(findings, [], first.id, { action: 'NOT_ABOUT_ME' });
    expect(decisions).toEqual([
      { findingId: first.id, action: 'NOT_ABOUT_ME' },
      { findingId: second.id, action: 'NOT_ABOUT_ME', propagatedFrom: first.id },
    ]);
  });

  it('does not touch a different quote that merely contains it', () => {
    const decisions = propagateDecision(findings, [], first.id, { action: 'KEPT_RISK' });
    expect(decisions.map((d) => d.findingId)).not.toContain(longer.id);
  });

  it('never overrides an explicit decision on a sibling', () => {
    const decisions = propagateDecision(findings, [keep(second)], first.id, {
      action: 'NOT_ABOUT_ME',
    });
    expect(decisions).toContainEqual(keep(second));
    expect(decisions).toHaveLength(2);
  });

  it('replaces earlier propagated copies with the new choice', () => {
    const once = propagateDecision(findings, [], first.id, { action: 'NOT_ABOUT_ME' });
    const twice = propagateDecision(findings, once, first.id, { action: 'KEPT_RISK' });
    expect(twice).toEqual([
      { findingId: first.id, action: 'KEPT_RISK' },
      { findingId: second.id, action: 'KEPT_RISK', propagatedFrom: first.id },
    ]);
  });

  it('a direct choice on a sibling turns its copy into an explicit decision', () => {
    const once = propagateDecision(findings, [], first.id, { action: 'NOT_ABOUT_ME' });
    const decisions = propagateDecision(findings, once, second.id, { action: 'KEPT_RISK' });
    expect(decisions).toContainEqual({ findingId: second.id, action: 'KEPT_RISK' });
    expect(decisions).toContainEqual({ findingId: first.id, action: 'NOT_ABOUT_ME' });
  });

  it('carries the replacement of an EDITED choice to the copies', () => {
    const decisions = propagateDecision(findings, [], first.id, {
      action: 'EDITED',
      replacement: 'a manager',
    });
    expect(decisions[1]).toEqual({
      findingId: second.id,
      action: 'EDITED',
      replacement: 'a manager',
      propagatedFrom: first.id,
    });
  });

  it('changes nothing for an unknown finding id', () => {
    const existing = [keep(first)];
    expect(propagateDecision(findings, existing, 'ghost', { action: 'KEPT_RISK' })).toEqual(
      existing,
    );
  });
});

describe('undoDecision', () => {
  it('removes the decision and every copy made from it', () => {
    const decisions = propagateDecision(findings, [keep(longer)], first.id, {
      action: 'NOT_ABOUT_ME',
    });
    expect(undoDecision(decisions, first.id)).toEqual([keep(longer)]);
  });

  it('undoing a copy marks only that finding as cleared by the reporter', () => {
    const decisions = propagateDecision(findings, [], first.id, { action: 'NOT_ABOUT_ME' });
    expect(undoDecision(decisions, second.id)).toEqual([
      { findingId: first.id, action: 'NOT_ABOUT_ME' },
      { findingId: second.id, action: 'PENDING_BY_USER' },
    ]);
  });

  it('a later choice on the source does not override the cleared copy', () => {
    const decisions = propagateDecision(findings, [], first.id, { action: 'NOT_ABOUT_ME' });
    const cleared = undoDecision(decisions, second.id);
    const again = propagateDecision(findings, cleared, first.id, { action: 'KEPT_RISK' });
    expect(again).toEqual([
      { findingId: second.id, action: 'PENDING_BY_USER' },
      { findingId: first.id, action: 'KEPT_RISK' },
    ]);
  });

  it('undoing the marker makes the finding open to propagation again', () => {
    const cleared = [{ findingId: second.id, action: 'PENDING_BY_USER' as const }];
    expect(undoDecision(cleared, second.id)).toEqual([]);
  });
});
