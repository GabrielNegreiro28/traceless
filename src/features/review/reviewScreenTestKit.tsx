import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReviewingState } from './reportFlowMachine';
import { SECOND_LOOK_CONFIRM_LABEL } from './SecondLook';
import { reviewing } from './reportFlowTestKit';
import { ReviewHarness } from './ReviewHarness.testKit';
import { spies } from './reviewSpies.testKit';

export { spies };

export function renderReview(initial: ReviewingState = reviewing) {
  for (const spy of Object.values(spies)) spy.mockClear();
  return render(<ReviewHarness initial={initial} />);
}

/** The card that quotes `quote` (the first one when the quote repeats). */
export function cardOf(quote: string, index = 0): HTMLElement {
  const cards = screen
    .getAllByRole('article')
    .filter((card) => within(card).queryByText(`“${quote}”`) !== null);
  const card = cards[index];
  if (card === undefined) throw new Error(`no card for ${quote}`);
  return card;
}

/** The Second look confirmation checkbox. */
export const secondLookBox = (): HTMLElement =>
  screen.getByRole('checkbox', { name: SECOND_LOOK_CONFIRM_LABEL });

export const liveMessage = (): string => screen.getByRole('status').textContent ?? '';

export const click = (name: string | RegExp, scope: HTMLElement = document.body) =>
  userEvent.click(within(scope).getByRole('button', { name }));

/** Puts keyboard focus on the card that quotes `quote` (what tabbing to it does). */
export async function focusCardOf(quote: string, index = 0): Promise<void> {
  await userEvent.click(within(cardOf(quote, index)).getByRole('blockquote'));
}
