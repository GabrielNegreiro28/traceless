import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { cardOf, focusCardOf, liveMessage, renderReview, spies } from './reviewScreenTestKit';
import { isTypingTarget } from './useReviewShortcuts';

describe('review keyboard shortcuts (only while a card is focused)', () => {
  it('A accepts the focused card and moves focus to the next one', async () => {
    renderReview();
    await focusCardOf('Dock B');
    await userEvent.keyboard('a');
    expect(spies.onDecide).toHaveBeenCalledWith(expect.stringContaining('t:'), {
      action: 'ACCEPTED',
    });
    expect(cardOf('Mr. Alvarez', 0)).toHaveFocus();
    expect(liveMessage()).toMatch(/^Accepted\./);
  });

  it('act on the card that has focus, not on the selected one', async () => {
    renderReview();
    expect(cardOf('the night lead')).toHaveAttribute('aria-current', 'true');
    await focusCardOf('Dock B');
    await userEvent.keyboard('k');
    expect(cardOf('Dock B')).toHaveTextContent('Kept as written');
    expect(cardOf('the night lead')).not.toHaveTextContent('Kept as written');
  });

  it('K keeps and N marks as not about me, in either letter case', async () => {
    renderReview();
    await focusCardOf('the night lead');
    await userEvent.keyboard('K');
    expect(spies.onDecide).toHaveBeenLastCalledWith(expect.any(String), { action: 'KEPT_RISK' });
    await userEvent.keyboard('n');
    expect(spies.onDecide).toHaveBeenLastCalledWith(expect.any(String), { action: 'NOT_ABOUT_ME' });
  });

  it('E opens the editor without typing the letter, and Enter saves', async () => {
    renderReview();
    await focusCardOf('Dock B');
    await userEvent.keyboard('e');
    const input = screen.getByRole<HTMLInputElement>('textbox');
    expect(input.value).toBe('[place]');
    await userEvent.keyboard('{Enter}');
    expect(spies.onDecide).toHaveBeenCalledWith(expect.any(String), {
      action: 'EDITED',
      replacement: '[place]',
    });
  });

  it('do nothing with focus on Continue, Back to edit, a mark or the page', async () => {
    renderReview();
    for (const target of [
      screen.getByRole('button', { name: 'Continue' }),
      screen.getByRole('button', { name: 'Back to edit' }),
      screen.getByRole('button', { name: /^Dock B\s*\[/ }),
      document.body,
    ]) {
      if (target instanceof HTMLElement && target !== document.body) target.focus();
      await userEvent.keyboard('akne');
    }
    expect(spies.onDecide).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('ignore a held-down key: only the first keydown decides', async () => {
    renderReview();
    await focusCardOf('the night lead');
    const first = cardOf('the night lead');
    fireEvent.keyDown(first, { key: 'k', repeat: true });
    expect(spies.onDecide).not.toHaveBeenCalled();
    fireEvent.keyDown(first, { key: 'k' });
    expect(spies.onDecide).toHaveBeenCalledTimes(1);
    // Focus moved to the next card; the key is still held, so its repeats are ignored.
    fireEvent.keyDown(cardOf('Dock B'), { key: 'k', repeat: true });
    fireEvent.keyDown(cardOf('Dock B'), { key: 'k', repeat: true });
    expect(spies.onDecide).toHaveBeenCalledTimes(1);
  });

  it('are ignored while typing in the edit input and with a modifier key held', async () => {
    renderReview();
    await focusCardOf('Dock B');
    await userEvent.keyboard('{Control>}a{/Control}');
    expect(spies.onDecide).not.toHaveBeenCalled();
    await userEvent.keyboard('e');
    const input = screen.getByRole<HTMLInputElement>('textbox');
    await userEvent.clear(input);
    await userEvent.keyboard('kanE');
    expect(input.value).toBe('kanE');
    expect(spies.onDecide).not.toHaveBeenCalled();
  });

  it('are ignored on a card that is already decided', async () => {
    renderReview();
    await focusCardOf('the night lead');
    await userEvent.keyboard('a');
    await focusCardOf('the night lead');
    await userEvent.keyboard('a');
    expect(spies.onDecide).toHaveBeenCalledTimes(1);
  });

  it('activating a mark moves focus to its card, so the keys work right after a click', async () => {
    renderReview();
    await userEvent.click(screen.getByRole('button', { name: /^Dock B\s*\[/ }));
    expect(cardOf('Dock B')).toHaveFocus();
    await userEvent.keyboard('k');
    expect(spies.onDecide).toHaveBeenCalledTimes(1);
    expect(cardOf('Dock B')).toHaveTextContent('Kept as written');
  });
});

describe('isTypingTarget', () => {
  it('is true for fields and false for buttons', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
