import { describe, expect, it } from 'vitest';
import { scoreRisk } from '../risk/riskScorer';
import { accept, edit, findingOf, keep, notAboutMe } from '../rewrite/rewriteTestKit';
import { changedSpans, isDecisionValid, remainingFindings, remainingRisk } from './reviewState';

const text = 'I am the only night shift lead at Dock B since March 3.';
const role = findingOf(text, 'the only night shift lead', { category: 'ROLE_UNIQUE' });
const shift = findingOf(text, 'night shift', { category: 'SCHEDULE' });
const dock = findingOf(text, 'Dock B', { category: 'LOCATION' });
const date = findingOf(text, 'March 3', { category: 'PERSONAL_EVENT_DATE', origin: 'RULE' });
const all = [role, shift, dock, date];
const ids = (findings: readonly { id: string }[]) => findings.map((f) => f.id);

describe('remainingFindings', () => {
  it('keeps every finding while nothing is decided (pending)', () => {
    expect(ids(remainingFindings(all, []))).toEqual(ids(all));
  });

  it('drops ACCEPTED and EDITED findings', () => {
    expect(ids(remainingFindings(all, [accept(dock), edit(date, 'recently')]))).toEqual(
      ids([role, shift]),
    );
  });

  it('keeps KEPT_RISK findings and drops NOT_ABOUT_ME findings', () => {
    expect(ids(remainingFindings(all, [keep(dock), notAboutMe(date)]))).toEqual(
      ids([role, shift, dock]),
    );
  });

  it('drops a finding swallowed by an accepted span, whatever its own decision', () => {
    expect(ids(remainingFindings(all, [accept(role), keep(shift)]))).toEqual(ids([dock, date]));
  });

  it('treats the PENDING_BY_USER marker as pending', () => {
    const marker = { findingId: dock.id, action: 'PENDING_BY_USER' as const };
    expect(ids(remainingFindings(all, [marker]))).toEqual(ids(all));
  });

  it('ignores decisions for unknown findings', () => {
    const ghost = { findingId: 'ghost', action: 'ACCEPTED' as const };
    expect(ids(remainingFindings(all, [ghost]))).toEqual(ids(all));
  });
});

describe('remainingRisk', () => {
  it('equals scoreRisk(pending + KEPT_RISK)', () => {
    const decisions = [keep(dock), notAboutMe(date), accept(role)];
    expect(remainingRisk(all, decisions)).toEqual(scoreRisk([dock]));
  });

  it('goes down as findings are resolved', () => {
    const before = remainingRisk(all, []).score;
    const after = remainingRisk(all, [accept(role)]).score;
    const done = remainingRisk(all, [accept(role), accept(dock), notAboutMe(date)]);
    expect(after).toBeLessThan(before);
    expect(done.level).toBe('NONE');
  });
});

describe('changedSpans', () => {
  it('merges overlapping changes like the applier', () => {
    expect(changedSpans(all, [accept(shift), accept(role), keep(dock)])).toEqual([role.span]);
  });
});

describe('isDecisionValid', () => {
  it('requires a known finding', () => {
    expect(isDecisionValid(all, 'ghost', { action: 'KEPT_RISK' })).toBe(false);
    expect(isDecisionValid(all, dock.id, { action: 'KEPT_RISK' })).toBe(true);
  });

  it('requires a replacement for EDITED', () => {
    expect(isDecisionValid(all, dock.id, { action: 'EDITED' })).toBe(false);
    expect(isDecisionValid(all, dock.id, { action: 'EDITED', replacement: '' })).toBe(true);
  });
});
