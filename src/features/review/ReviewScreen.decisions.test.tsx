import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { scoreRisk } from '../../domain/risk/riskScorer';
import { reviewing } from './reportFlowTestKit';
import { cardOf, click, liveMessage, renderReview, spies } from './reviewScreenTestKit';

describe('ReviewScreen decisions', () => {
  it('Accept dispatches ACCEPTED and shows the replacement in the text', async () => {
    renderReview();
    await click('Accept', cardOf('Dock B'));
    expect(spies.onDecide).toHaveBeenCalledWith(expect.stringContaining('t:'), {
      action: 'ACCEPTED',
    });
    expect(within(cardOf('Dock B')).getByText(/will become/)).toBeVisible();
    const mark = document.querySelector('mark[data-state="accepted"]');
    expect(mark?.querySelector('del')).toHaveTextContent('Dock B');
    expect(mark?.nextElementSibling).toHaveTextContent('[place]');
  });

  it('Accept removes the detail when the suggestion is empty', async () => {
    const dock = { ...reviewing.findings[1], suggestion: '' };
    renderReview({ ...reviewing, findings: [dock] as typeof reviewing.findings });
    await click('Accept');
    expect(screen.getByText('This detail will be removed.')).toBeVisible();
    expect(document.querySelector('ins')).toHaveTextContent('(removed)');
  });

  it('Edit opens an input prefilled with the suggestion; Save dispatches EDITED', async () => {
    renderReview();
    await click('Edit', cardOf('Dock B'));
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: /Your replacement/ });
    expect(input.value).toBe('[place]');
    expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.type(input, 'the dock');
    await click('Save');
    expect(spies.onDecide).toHaveBeenCalledWith(expect.any(String), {
      action: 'EDITED',
      replacement: 'the dock',
    });
    expect(within(cardOf('Dock B')).getByText(/will become/)).toHaveTextContent('the dock');
  });

  it('Edit with Enter saves and an empty edit removes the detail', async () => {
    renderReview();
    await click('Edit', cardOf('Dock B'));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.keyboard('{Enter}');
    expect(spies.onDecide).toHaveBeenCalledWith(expect.any(String), {
      action: 'EDITED',
      replacement: '',
    });
    expect(within(cardOf('Dock B')).getByText('This detail will be removed.')).toBeVisible();
  });

  it('Cancel (and Escape) closes the editor without a decision', async () => {
    renderReview();
    await click('Edit', cardOf('Dock B'));
    await click('Cancel');
    expect(screen.queryByRole('textbox')).toBeNull();
    await click('Edit', cardOf('Dock B'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(spies.onDecide).not.toHaveBeenCalled();
    expect(cardOf('Dock B')).toHaveFocus();
  });

  it('Keep anyway dispatches KEPT_RISK and the risk stays', async () => {
    renderReview();
    await click('Keep anyway', cardOf('Dock B'));
    expect(spies.onDecide).toHaveBeenCalledWith(expect.any(String), { action: 'KEPT_RISK' });
    expect(within(cardOf('Dock B')).getByText(/still counts toward your risk/)).toBeVisible();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'Risk: high');
  });

  it('Not about me dispatches NOT_ABOUT_ME and says how many identical mentions it covers', async () => {
    renderReview();
    await click('Not about me', cardOf('Mr. Alvarez', 0));
    expect(spies.onDecide).toHaveBeenCalledWith(expect.any(String), { action: 'NOT_ABOUT_ME' });
    expect(
      within(cardOf('Mr. Alvarez', 0)).getByText('Also applied to 1 identical mention.'),
    ).toBeVisible();
    expect(
      within(cardOf('Mr. Alvarez', 1)).getByText(/Applied because the same words/),
    ).toBeVisible();
    expect(within(cardOf('Mr. Alvarez', 1)).queryByText(/Also applied to/)).toBeNull();
  });

  it('Undo dispatches UNDO_DECISION and the card is undecided again', async () => {
    renderReview();
    await click('Accept', cardOf('Dock B'));
    await click('Undo', cardOf('Dock B'));
    expect(spies.onUndo).toHaveBeenCalledTimes(1);
    expect(within(cardOf('Dock B')).getByRole('button', { name: 'Accept' })).toBeVisible();
    expect(liveMessage()).toMatch(/^Undone\. Risk: high\. 4 left\.$/);
  });
});

describe('ReviewScreen focus, announcements and the footer', () => {
  it('auto-advances to the next undecided card and moves focus there', async () => {
    renderReview();
    await click('Accept', cardOf('the night lead'));
    expect(cardOf('Dock B')).toHaveAttribute('aria-current', 'true');
    expect(cardOf('Dock B')).toHaveFocus();
  });

  it('announces the change politely, with the risk and how many are left', async () => {
    renderReview();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await click('Accept', cardOf('the night lead'));
    expect(liveMessage()).toMatch(/^Accepted\. Risk: (low|medium|high)\. 3 left\.$/);
  });

  it('lowers the risk to low as every card is resolved, then says none are left', async () => {
    renderReview();
    for (const quote of ['the night lead', 'Dock B']) await click('Accept', cardOf(quote));
    await click('Not about me', cardOf('Mr. Alvarez', 0));
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'Risk: none');
    expect(liveMessage()).toBe('Marked as not about you. Risk: none. None left.');
    expect(screen.queryByText(/still undecided/)).toBeNull();
    expect(screen.getByText('No identifying details are left in your text.')).toBeVisible();
  });

  it('Continue is always enabled and shows what is still undecided', async () => {
    renderReview();
    expect(screen.getByText('4 details still undecided')).toBeVisible();
    await click(/^Dock B\s*\[Location/);
    await click('Accept', cardOf('Dock B'));
    expect(screen.getByText('3 details still undecided')).toBeVisible();
    await click('Continue');
    expect(spies.onContinue).toHaveBeenCalledTimes(1);
  });

  it('Back to edit calls its handler', async () => {
    renderReview();
    await click('Back to edit');
    expect(spies.onBackToEdit).toHaveBeenCalledTimes(1);
  });

  it('uses the singular for one undecided detail', () => {
    const dock = reviewing.findings[1];
    renderReview({
      ...reviewing,
      findings: [dock] as typeof reviewing.findings,
      risk: scoreRisk([]),
    });
    expect(screen.getByText('1 detail still undecided')).toBeVisible();
  });
});
