import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_REPORT } from '../features/compose/sampleReport';
import { reloadPage } from '../features/review/pageActions';
import { controllableScan, settle } from '../features/review/useReportFlow.testKit';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { createAppError } from '../shared/appError';
import { createAppRoutes } from './router';
import { renderWithServices } from './services/renderWithServices';

/** /report after a stalled on-device scan (docs/design/fase2-gate-iteration.md §G.2). */

vi.mock('../features/review/pageActions', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  reloadPage: vi.fn(),
}));

const stuck = (recoverable: boolean) =>
  createAppError('OnDeviceStuck', { message: 'stalled', recoverable });

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

async function stalledScan(recoverable: boolean) {
  const scan = controllableScan();
  const identityScanner = new FakeIdentityScanner();
  const router = createMemoryRouter(createAppRoutes([]), { initialEntries: ['/report'] });
  const { services } = renderWithServices(<RouterProvider router={router} />, {
    scanReport: scan.scanReport,
    identityScanner,
  });
  await click('Try a sample report');
  await click('Check my report');
  await heading('Checking your report');
  await settle(() => scan.calls[0]?.fail(stuck(recoverable)));
  return { scan, identityScanner, services };
}

describe('/report after an on-device stall', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('recoverable: Try again rescans the same text and opens the review', async () => {
    const { scan } = await stalledScan(true);
    await heading('On-device AI stalled');
    await click('Try again');
    await heading('Checking your report');
    expect(scan.calls).toHaveLength(2);
    expect(scan.calls[1]?.text).toBe(SAMPLE_REPORT);
    await settle(() => scan.calls[1]?.succeed([]));
    await heading('Review your report');
    expect(screen.queryByText('Only basic checks ran')).toBeNull();
  });

  it('terminal: basic checks review the rule findings only, with no model call', async () => {
    const { scan, identityScanner, services } = await stalledScan(false);
    await heading("On-device AI isn't responding");
    await click('Continue with basic checks');

    await heading('Review your report');
    expect(screen.getByRole('note')).toHaveTextContent('Only basic checks ran');
    expect(screen.getByText('Second look').closest('details')).toHaveAttribute('open');
    expect(scan.calls).toHaveLength(1);
    expect(identityScanner.chunks).toEqual([]);
    expect(services.privacyLedger.entries()).toMatchObject([
      { task: 'identityScan', source: 'rules', dataClass: 'RAW', demo: false },
    ]);
    // The ledger panel (collapsed by default) lists the step as rules only.
    expect(screen.getByRole('list', { name: 'Steps so far' })).toHaveTextContent(
      'pattern rules only',
    );
  });

  it('terminal: copies the text, warns, and reloads only after Reload now', async () => {
    await stalledScan(false);
    await heading("On-device AI isn't responding");
    await click('Copy my text and reload');

    expect(writeText).toHaveBeenCalledExactlyOnceWith(SAMPLE_REPORT);
    expect(await screen.findByText(/Reloading clears the draft from this page\./)).toBeVisible();
    expect(reloadPage).not.toHaveBeenCalled();
    await click('Reload now');
    expect(reloadPage).toHaveBeenCalledOnce();
  });
});
