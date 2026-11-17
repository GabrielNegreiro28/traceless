import { describe, expect, it } from 'vitest';
import { buildFindingId } from '../detection/span';
import type { Finding } from '../detection/types';
import { SAMPLE_REPORT } from '../report/sampleReport';
import { applyDecisions } from '../rewrite/rewriteApplier';
import { toRawText } from '../text/brandedText';
import { guardSuggestions } from './suggestionGuard';
import { keepSubjectVerb } from './subjectVerbGuard';

function findingIn(text: string, quote: string, suggestion: string | null): Finding {
  const start = text.indexOf(quote);
  const span = { start, end: start + quote.length };
  const id = buildFindingId('MODEL', span, 'ROLE_UNIQUE');
  return { id, span, quote, category: 'ROLE_UNIQUE', reason: 'r', suggestion, origin: 'MODEL' };
}

describe('keepSubjectVerb', () => {
  it('keeps the verb when the suggestion is a bare plural noun after "I"', () => {
    const text = 'I sign the dock safety checklist at the start of every shift.';
    const finding = findingIn(text, 'sign the dock safety checklist', 'logs');
    expect(keepSubjectVerb(text, finding)).toBe('sign logs');
  });

  it('keeps the verb when the suggestion starts a noun phrase after "we"', () => {
    const text = 'Every morning we unload the Berlin trucks.';
    const finding = findingIn(text, 'unload the Berlin trucks', 'the trucks');
    expect(keepSubjectVerb(text, finding)).toBe('unload the trucks');
  });

  it.each([
    ['a verb phrase', 'sign the dock safety checklist', 'sign a checklist'],
    ['"was"', 'sign the dock safety checklist', 'was on duty'],
    ['a removal', 'sign the dock safety checklist', null],
  ])('leaves %s unchanged', (_label, quote, suggestion) => {
    const text = 'I sign the dock safety checklist at the start of every shift.';
    expect(keepSubjectVerb(text, findingIn(text, quote, suggestion))).toBe(suggestion);
  });

  it('leaves a quote that does not follow a subject unchanged', () => {
    const text = 'My name is on the dock safety checklist.';
    const finding = findingIn(text, 'the dock safety checklist', 'logs');
    expect(keepSubjectVerb(text, finding)).toBe('logs');
  });

  it('does not treat a word ending in "I" as the subject', () => {
    const text = 'Taxi drivers sign the logs.';
    const finding = findingIn(text, 'drivers sign the logs', 'logs');
    expect(keepSubjectVerb(text, finding)).toBe('logs');
  });
});

describe('guardSuggestions on the sample report', () => {
  it('turns the "I logs" rewrite into "I sign logs"', () => {
    const text = toRawText(SAMPLE_REPORT);
    const finding = findingIn(SAMPLE_REPORT, 'sign the dock safety checklist', 'logs');
    const [guarded] = guardSuggestions(text, [finding]);
    expect(guarded?.suggestion).toBe('sign logs');
    const accepted = applyDecisions(
      text,
      [guarded!],
      [{ findingId: finding.id, action: 'ACCEPTED' }],
    );
    expect(accepted.ok && accepted.value).toContain('I sign logs at the start of every shift');
  });
});
