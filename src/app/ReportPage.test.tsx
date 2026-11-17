import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { SAMPLE_REPORT } from '../features/compose/sampleReport';
import { controllableScan, settle } from '../features/review/useReportFlow.testKit';
import { FakeDeviceCapability } from '../infrastructure/fakes/FakeDeviceCapability';
import type { Services } from './compositionRoot';
import { createAppRoutes } from './router';
import { renderWithServices } from './services/renderWithServices';

function openReport(overrides: Partial<Services> = {}) {
  const router = createMemoryRouter(createAppRoutes([]), { initialEntries: ['/report'] });
  return renderWithServices(<RouterProvider router={router} />, overrides);
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

describe('/report flow on fake services', () => {
  it('goes from the sample through the scan to the review', async () => {
    openReport();
    await heading('Write your report');
    await click('Try a sample report');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(SAMPLE_REPORT);

    await click('Check my report');
    const review = await heading('Review your report');
    expect(screen.getByRole('meter')).toBeVisible();
    await waitFor(() => expect(review).toHaveFocus());

    await click('Back to edit');
    await heading('Write your report');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(SAMPLE_REPORT);
  });

  it('shows progress while scanning and cancelling keeps the text', async () => {
    const scan = controllableScan();
    openReport({ scanReport: scan.scanReport });
    await heading('Write your report');
    await click('Try a sample report');
    await click('Check my report');

    const scanning = await heading('Checking your report');
    await waitFor(() => expect(scanning).toHaveFocus());
    act(() => scan.calls[0]?.onProgress?.(1, 2));
    expect(await screen.findByText('Finished 1 of 2 steps.')).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');

    await click('Cancel');
    await heading('Write your report');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(SAMPLE_REPORT);
  });

  it('shows a friendly error and returns to the text on Try again', async () => {
    const scan = controllableScan();
    openReport({ scanReport: scan.scanReport });
    await click('Try a sample report');
    await click('Check my report');
    await heading('Checking your report');
    await settle(() => scan.calls[0]?.crash());

    await heading("That didn't work");
    expect(screen.getByRole('alert')).toHaveTextContent(/Something went wrong/);
    await click('Try again');
    await heading('Write your report');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(SAMPLE_REPORT);
  });

  it('sets up the model from its own click, then scans and opens the review', async () => {
    const deviceCapability = new FakeDeviceCapability({
      availability: 'downloadable',
      progress: [0.5, 1],
    });
    openReport({ deviceCapability });
    await click('Try a sample report');
    await click('Check my report');

    await heading('Set up private mode');
    expect(deviceCapability.prepareCalls).toBe(0);
    await click('Prepare private AI');
    expect(deviceCapability.prepareCalls).toBe(1);
    await heading('Review your report');
  });

  it('offers the other ways to check, without scanning, when on-device AI is unavailable', async () => {
    const deviceCapability = new FakeDeviceCapability({ availability: 'unavailable' });
    const scan = controllableScan();
    openReport({ deviceCapability, scanReport: scan.scanReport });
    await click('Try a sample report');
    await click('Check my report');

    await heading('Choose how to check your report');
    expect(
      screen.getByText(/Nothing leaves this device unless you choose the cloud check/),
    ).toBeVisible();
    expect(scan.calls).toHaveLength(0);
    await click('Back to edit');
    await heading('Write your report');
  });
});
