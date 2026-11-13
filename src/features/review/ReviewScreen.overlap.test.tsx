import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Finding } from '../../domain/detection/types';
import { accept, edit, findingOf } from '../../domain/rewrite/rewriteTestKit';
import { applyDecisions } from '../../domain/rewrite/rewriteApplier';
import { scoreRisk } from '../../domain/risk/riskScorer';
import { toRawText } from '../../domain/text/brandedText';
import type { ReviewingState } from './reportFlowTypes';
import { cardOf, click, liveMessage, renderReview, spies } from './reviewScreenTestKit';

const TEXT = 'I am the night shift lead at Dock B.';
const LEAD = findingOf(TEXT, 'the night shift lead', { suggestion: 'a staff member' });
const SHIFT = findingOf(TEXT, 'night shift', { suggestion: 'a shift' });
const LEAD_AT = findingOf(TEXT, 'lead at Dock B', { suggestion: 'in the warehouse' });

function reviewingOf(text: string, findings: readonly Finding[]): ReviewingState {
  return {
    status: 'reviewing',
    text: toRawText(text),
    checks: 'full',
    findings,
    protectedSpans: [],
    decisions: [],
    risk: scoreRisk(findings),
  };
}

const insTexts = (): (string | null)[] =>
  Array.from(document.querySelectorAll('ins')).map((el) => el.textContent);

describe('ReviewScreen with overlapping findings', () => {
  it('a pending finding inside an accepted one is covered, struck and not counted', async () => {
    renderReview(reviewingOf(TEXT, [LEAD, SHIFT]));
    await click('Accept', cardOf('the night shift lead'));

    const inner = cardOf('night shift');
    expect(within(inner).getByText('Removed by an overlapping change')).toBeVisible();
    expect(within(inner).getByText(/Undo that change to decide about this one/)).toBeVisible();
    expect(within(inner).queryByRole('button')).toBeNull();
    expect(liveMessage()).toMatch(/None left\.$/);
    expect(screen.queryByText(/still undecided/)).toBeNull();
    for (const mark of document.querySelectorAll('mark')) {
      expect(mark.querySelector('del')).not.toBeNull();
    }
    expect(insTexts()).toEqual(['a staff member']);
  });

  it('skips a covered finding when auto-advancing', async () => {
    const dock = findingOf(TEXT, 'Dock B');
    renderReview(reviewingOf(TEXT, [LEAD, SHIFT, dock]));
    await click('Accept', cardOf('the night shift lead'));
    expect(cardOf('Dock B')).toHaveAttribute('aria-current', 'true');
    expect(cardOf('Dock B')).toHaveFocus();
    expect(screen.getByText('1 detail still undecided')).toBeVisible();
  });

  it('undoing the wider change gives the covered finding its actions back', async () => {
    renderReview(reviewingOf(TEXT, [LEAD, SHIFT]));
    await click('Accept', cardOf('the night shift lead'));
    await click('Undo', cardOf('the night shift lead'));
    expect(within(cardOf('night shift')).getByRole('button', { name: 'Accept' })).toBeVisible();
    expect(insTexts()).toEqual([]);
  });

  it('an inner edit wins over the outer accept, and the card shows what the applier produces', async () => {
    renderReview(reviewingOf(TEXT, [LEAD, SHIFT]));
    await click('Edit', cardOf('night shift'));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'a crew');
    await click('Save');
    await click('Accept', cardOf('the night shift lead'));

    expect(spies.onDecide).toHaveBeenCalledTimes(2);
    const applied = applyDecisions(
      toRawText(TEXT),
      [LEAD, SHIFT],
      [edit(SHIFT, 'a crew'), accept(LEAD)],
    );
    expect(applied.ok && applied.value).toBe('I am a crew at Dock B.');
    expect(within(cardOf('the night shift lead')).getByText(/will become/)).toHaveTextContent(
      'a crew',
    );
    expect(within(cardOf('night shift')).getByText(/will become/)).toHaveTextContent('a crew');
    expect(insTexts()).toEqual(['a crew']);
  });

  it('merges a partial overlap into one change with the earliest finding replacement', async () => {
    renderReview(reviewingOf(TEXT, [LEAD, LEAD_AT]));
    await click('Accept', cardOf('lead at Dock B'));
    await click('Accept', cardOf('the night shift lead'));

    const applied = applyDecisions(
      toRawText(TEXT),
      [LEAD, LEAD_AT],
      [accept(LEAD_AT), accept(LEAD)],
    );
    expect(applied.ok && applied.value).toBe('I am a staff member.');
    expect(insTexts()).toEqual(['a staff member']);
    expect(within(cardOf('lead at Dock B')).getByText(/will become/)).toHaveTextContent(
      'a staff member',
    );
    const struck = Array.from(document.querySelectorAll('del')).map((d) => d.textContent ?? '');
    expect(struck.join('').replace(/\[[^\]]*\]/g, '')).toBe('the night shift lead at Dock B');
  });

  it('keeps a partly overlapping pending finding undecided and counted', async () => {
    renderReview(reviewingOf(TEXT, [LEAD, LEAD_AT]));
    await click('Accept', cardOf('the night shift lead'));
    expect(within(cardOf('lead at Dock B')).getByRole('button', { name: 'Accept' })).toBeVisible();
    expect(screen.getByText('1 detail still undecided')).toBeVisible();
  });

  it('shows the replacement once even when the span end was widened past an emoji', async () => {
    const text = 'work \u{1F600}x';
    const cut = { ...findingOf(text, 'work'), span: { start: 0, end: 6 }, suggestion: 'job' };
    const finding: Finding = { ...cut, quote: text.slice(0, 6) };
    renderReview(reviewingOf(text, [finding]));
    await click('Accept');
    expect(insTexts()).toEqual(['job']);
  });
});
