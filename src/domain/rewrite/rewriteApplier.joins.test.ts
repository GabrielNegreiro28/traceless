import { describe, expect, it } from 'vitest';
import { SAMPLE_REPORT } from '../report/sampleReport';
import { toRawText } from '../text/brandedText';
import type { Finding } from '../detection/types';
import { accept, findingOf } from './rewriteTestKit';
import { applyDecisions } from './rewriteApplier';

/** Regressions from the real-browser walkthrough of the sample report (accept every card). */

function acceptAll(text: string, findings: readonly Finding[]): string {
  const result = applyDecisions(toRawText(text), findings, findings.map(accept));
  if (!result.ok) throw new Error(`unexpected error: ${result.error.message}`);
  return result.value;
}

describe('applyDecisions: determiner collisions', () => {
  it('keeps only the suggestion determiner ("at the a company location")', () => {
    const depot = findingOf(SAMPLE_REPORT, 'Halvern Freight depot in Brackenford, Dock 4', {
      suggestion: 'a company location',
    });
    expect(acceptAll(SAMPLE_REPORT, [depot])).toContain('forklift trainer at a company location.');
  });

  it.each([
    ['I met my the manager.', 'the manager', 'a manager', 'I met a manager.'],
    ['The Dock 4 crew saw it.', 'Dock 4 crew', 'the crew', 'The crew saw it.'],
    ['An the Leeds office.', 'the Leeds office', 'an office', 'An office.'],
  ])('%s', (text, quote, suggestion, expected) => {
    const finding = findingOf(text, quote, { suggestion });
    expect(acceptAll(text, [finding])).toBe(expected);
  });

  it('leaves a determiner alone when the suggestion has none', () => {
    const text = 'I work at the Brackenford depot.';
    const finding = findingOf(text, 'Brackenford depot', { suggestion: 'depot' });
    expect(acceptAll(text, [finding])).toBe('I work at the depot.');
  });

  it('never treats a pronoun or conjunction before the span as a determiner', () => {
    const text = 'I told her Gary said that Dock 4 was closed.';
    const finding = findingOf(text, 'Dock 4', { suggestion: 'the dock' });
    expect(acceptAll(text, [finding])).toBe('I told her Gary said that the dock was closed.');
  });
});

describe('applyDecisions: punctuation collisions at span boundaries', () => {
  it('drops a cut abbreviation dot before a comma ("some shifts., and")', () => {
    const text = 'I work Tuesday to Saturday, from 10 p.m. to 6 a.m., and I sign.';
    const finding = findingOf(text, 'Tuesday to Saturday, from 10 p.m. to 6 a.m', {
      suggestion: 'some shifts',
    });
    expect(acceptAll(text, [finding])).toBe('I work some shifts, and I sign.');
  });

  it('collapses a suggestion ending in a dot with the text punctuation after it', () => {
    const text = 'I work nights, and I sign. I work nights.';
    const first = findingOf(text, 'nights', { suggestion: 'some shifts.' });
    const second = findingOf(text, 'nights', { id: 'second', suggestion: 'some shifts.' }, 1);
    expect(acceptAll(text, [first, second])).toBe(
      'I work some shifts, and I sign. I work some shifts.',
    );
  });

  it('drops a cut abbreviation dot when the span is removed', () => {
    const text = 'I start at 6 a.m., and I sign.';
    const finding = findingOf(text, 'at 6 a.m', { suggestion: null });
    expect(acceptAll(text, [finding])).toBe('I start, and I sign.');
  });

  it('keeps punctuation the span did not touch (ellipsis, ?!, plain end of sentence)', () => {
    const text = 'Was it Dock 4?! I saw Dock 4... and Dock 4.';
    const findings = [0, 1, 2].map((n) =>
      findingOf(text, 'Dock 4', { id: `d${n}`, suggestion: 'a dock' }, n),
    );
    expect(acceptAll(text, findings)).toBe('Was it a dock?! I saw a dock... and a dock.');
  });
});
