import { expect, test } from '@playwright/test';
import {
  acceptEveryCard,
  approveAfterReview,
  finishKeyScreen,
  openSample,
  sendAndReadKey,
  SAMPLE_PHRASE,
} from './flow';

test('raw report details never leave the page or reach browser storage', async ({ page }) => {
  const bodies: string[] = [];
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
    const body = request.postData();
    if (body !== null) bodies.push(body);
  });

  await openSample(page);
  await acceptEveryCard(page);
  await approveAfterReview(page);
  const approved = (await page.getByRole('figure', { name: 'Approved text' }).textContent()) ?? '';
  expect(approved.toLowerCase()).not.toContain(SAMPLE_PHRASE);

  const key = await sendAndReadKey(page);
  await finishKeyScreen(page);

  for (const body of bodies) {
    expect(body.toLowerCase()).not.toContain(SAMPLE_PHRASE);
    expect(body).not.toContain('Gary Pemberton');
  }
  // Fake mode is fully offline from the app's point of view: nothing but the dev server.
  const external = urls.filter((url) => !url.startsWith('http://localhost:5199'));
  expect(external).toEqual([]);

  const stored = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(stored.toLowerCase()).not.toContain('forklift');
  expect(stored).not.toContain(key);
  expect(stored).toBe('{"local":{},"session":{}}');
});
