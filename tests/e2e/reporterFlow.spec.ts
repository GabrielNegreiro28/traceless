import { expect, test } from '@playwright/test';
import {
  acceptEveryCard,
  approveAfterReview,
  CASE_KEY_PATTERN,
  finishKeyScreen,
  heading,
  openSample,
  sendAndReadKey,
} from './flow';

test('sample report: review, approve, send, then follow up with the case key', async ({ page }) => {
  await openSample(page);
  await expect(page.getByText(/demo/i).first()).toBeVisible();

  await acceptEveryCard(page);
  await approveAfterReview(page);
  await expect(
    page.getByRole('heading', { level: 2, name: 'What the organization will receive' }),
  ).toBeVisible();

  const key = await sendAndReadKey(page);
  expect(key).toMatch(CASE_KEY_PATTERN);
  await finishKeyScreen(page);

  // The demo backend lives in this tab, so reach /case by client-side navigation.
  await page.getByRole('banner').getByRole('link').first().click();
  await page.getByRole('link', { name: 'Follow up on your case' }).click();
  await expect(heading(page, 'Follow up on your case')).toBeVisible();
  await page.getByLabel('Case key').fill(key);
  await page.getByRole('button', { name: 'Look up case' }).click();
  await expect(page.getByText('Report received')).toBeVisible();
  await expect(page.getByLabel('Submitted text')).not.toContainText('forklift trainer');
});
