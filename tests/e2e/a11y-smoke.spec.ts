import { expect, test } from '@playwright/test';
import { openSample } from './flow';

test('review cards can be decided with the keyboard only', async ({ page }) => {
  await openSample(page);

  const accept = page.getByRole('button', { name: 'Accept', exact: true });
  const before = await accept.count();
  expect(before).toBeGreaterThan(0);

  // Focus the first card (cards are tabbable regions) and press A: that card is accepted.
  const card = page.locator('[data-finding-id]').first();
  await card.focus();
  await page.keyboard.press('a');
  await expect(accept).toHaveCount(before - 1);
});
