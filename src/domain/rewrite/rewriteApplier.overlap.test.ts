import { describe, expect, it } from 'vitest';
import type { Finding } from '../detection/types';
import { toRawText } from '../text/brandedText';
import { accept, edit, findingOf, keep } from './rewriteTestKit';
import { applyDecisions, type ReviewDecision } from './rewriteApplier';

function apply(
  text: string,
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): string {
  const result = applyDecisions(toRawText(text), findings, decisions);
  if (!result.ok) throw new Error(`unexpected error: ${result.error.message}`);
  return result.value;
}

describe('applyDecisions: overlaps and adjacency', () => {
  const text = 'I am the night shift lead at Dock B.';
  const lead = findingOf(text, 'the night shift lead', { suggestion: 'a staff member' });
  const shift = findingOf(text, 'night shift', { suggestion: 'a shift' });
  const leadAt = findingOf(text, 'lead at Dock B', { suggestion: 'in the warehouse' });

  it('a contained span merges into the outer one, which wins', () => {
    expect(apply(text, [lead, shift], [accept(shift), accept(lead)])).toBe(
      'I am a staff member at Dock B.',
    );
  });

  it('partial overlaps merge into the union with the earliest finding replacement', () => {
    expect(apply(text, [lead, leadAt], [accept(leadAt), accept(lead)])).toBe(
      'I am a staff member.',
    );
  });

  it('is independent of finding and decision order for overlaps', () => {
    const a = apply(text, [lead, leadAt, shift], [accept(shift), accept(leadAt), accept(lead)]);
    const b = apply(text, [shift, leadAt, lead], [accept(lead), accept(shift), accept(leadAt)]);
    expect(a).toBe(b);
  });

  it('an overlapping kept finding does not block the accepted one', () => {
    expect(apply(text, [lead, shift], [keep(shift), accept(lead)])).toBe(
      'I am a staff member at Dock B.',
    );
  });

  it('adjacent spans stay separate edits', () => {
    const glued = 'DockB';
    const dock = findingOf(glued, 'Dock', { suggestion: 'X' });
    const b = findingOf(glued, 'B', { suggestion: 'Y' });
    expect(apply(glued, [dock, b], [accept(dock), accept(b)])).toBe('XY');
  });

  it('with equal starts the longer span is primary', () => {
    const night = findingOf(text, 'the night', { suggestion: 'SHORT' });
    expect(apply(text, [night, lead], [accept(night), accept(lead)])).toBe(
      'I am a staff member at Dock B.',
    );
  });
});

describe('applyDecisions: typed text wins in a merged overlap', () => {
  it('keeps the EDITED replacement over an earlier ACCEPTED suggestion', () => {
    const text = 'We met at the Boston office on March 3rd.';
    const a = findingOf(text, 'the Boston office', { suggestion: 'an office' });
    const b = findingOf(text, 'Boston office on March 3rd', { category: 'PERSONAL_EVENT_DATE' });
    expect(apply(text, [a, b], [accept(a), edit(b, 'a meeting room recently')])).toBe(
      'We met at a meeting room recently.',
    );
  });
});
