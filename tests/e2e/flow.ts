import { expect, type Page } from '@playwright/test';

/** Shared steps of the reporter flow; text matches the shipped UI copy. */

export const SAMPLE_PHRASE = 'night-shift forklift trainer';
export const CASE_KEY_PATTERN = /^[0-9A-Za-z]{22}$/;

export const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

export async function openSample(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try a sample report' }).click();
  await expect(heading(page, 'Write your report')).toBeVisible();
  await page.getByRole('button', { name: 'Check my report' }).click();
  await expect(heading(page, 'Review your report')).toBeVisible();
}

/** Accepts cards one by one until no "Accept" button is left. */
export async function acceptEveryCard(page: Page): Promise<void> {
  const accept = page.getByRole('button', { name: 'Accept', exact: true });
  for (let guard = 0; guard < 40 && (await accept.count()) > 0; guard++) {
    await accept.first().click();
  }
  await expect(accept).toHaveCount(0);
}

/** Review → outbox → approved screen. */
export async function approveAfterReview(page: Page): Promise<void> {
  await page
    .getByRole('checkbox', { name: 'I re-read my report for details only I would know.' })
    .check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(heading(page, 'Only this text will leave your device')).toBeVisible();
  const acknowledgement = page.getByRole('checkbox');
  if ((await acknowledgement.count()) > 0) await acknowledgement.first().check();
  await page.getByRole('button', { name: 'Approve this text' }).click();
  await expect(
    heading(page, 'Approved. This is what the organization will receive.'),
  ).toBeVisible();
}

/** Send and return the case key (spaces removed). */
export async function sendAndReadKey(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Send to organization' }).click();
  await expect(heading(page, 'Report sent. Save your case key.')).toBeVisible();
  const shown = (await page.getByTestId('case-key').textContent()) ?? '';
  return shown.replace(/\s+/g, '');
}

export async function finishKeyScreen(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: 'I saved my key somewhere safe' }).check();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(heading(page, 'Write your report')).toBeVisible();
}
