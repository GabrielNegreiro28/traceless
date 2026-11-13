import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EvalScan } from '../../application/usecases/evaluateDetection';
import { EvalPage } from './EvalPage';
import { EvalServicesProvider } from './EvalServicesContext';
import type { EvalServices } from './evalServices';
import { EMPTY_SCAN, fakeDevice, fakeServices } from './evalTestKit';

function renderPage(services: EvalServices) {
  render(
    <EvalServicesProvider services={services}>
      <EvalPage />
    </EvalServicesProvider>,
  );
}

const button = (name: RegExp) => screen.getByRole('button', { name });

describe('EvalPage', () => {
  it('is idle with enabled run buttons when the device is ready', async () => {
    renderPage(fakeServices());

    expect(
      screen.getByRole('heading', { name: 'Detection evaluation (developer tool)' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/On-device AI is ready/)).toBeInTheDocument();
    expect(button(/1\. Smoke test/)).toBeEnabled();
    expect(button(/2\. Dev split/)).toBeEnabled();
    expect(button(/3\. Full evaluation/)).toBeEnabled();
  });

  it('offers to prepare the model when it is downloadable', async () => {
    const device = fakeDevice('downloadable');
    renderPage(fakeServices({ deviceCapability: device.capability }));

    expect(await screen.findByText(/not downloaded yet/)).toBeInTheDocument();
    expect(button(/1\. Smoke test/)).toBeDisabled();
    await userEvent.click(button(/Prepare on-device AI/));

    expect(device.prepareCalls()).toBe(1);
    await waitFor(() => expect(button(/1\. Smoke test/)).toBeEnabled());
  });

  it('shows live progress and disables every button while running', async () => {
    let release: () => void = () => undefined;
    let calls = 0;
    const scan: EvalScan = (text) => {
      calls += 1;
      if (calls === 1) return EMPTY_SCAN(text);
      return new Promise((resolve) => {
        release = () => resolve(EMPTY_SCAN(text));
      });
    };
    renderPage(fakeServices({ scanFor: () => scan }));
    await screen.findByText(/On-device AI is ready/);

    await userEvent.click(button(/2\. Dev split/));

    expect(await screen.findByText(/Run 1\/1, report 1\/2 \(a\)/)).toBeInTheDocument();
    expect(screen.getByText(/Keep this tab open and in the foreground/)).toBeInTheDocument();
    expect(screen.getByText(/Elapsed:/)).toBeInTheDocument();
    expect(screen.getByText(/Last report took/)).toBeInTheDocument();
    for (const name of [/1\. Smoke/, /2\. Dev/, /3\. Full/]) expect(button(name)).toBeDisabled();

    release();
    expect(await screen.findByText('Saved to eval/results/saved-file.json')).toBeInTheDocument();
    expect(button(/1\. Smoke test/)).toBeEnabled();
  });

  it('shows results, the save confirmation and a download button after a run', async () => {
    renderPage(fakeServices());
    await screen.findByText(/On-device AI is ready/);

    await userEvent.click(button(/1\. Smoke test/));

    expect(await screen.findByText('Saved to eval/results/saved-file.json')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/only applies to the test split/)).toBeInTheDocument();
    expect(button(/Download JSON/)).toBeEnabled();
  });

  it('explains a failed run in plain language', async () => {
    renderPage(fakeServices());
    await screen.findByText(/On-device AI is ready/);

    // The test dataset has no test-split reports, so the full evaluation cannot start.
    await userEvent.click(button(/3\. Full evaluation/));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not set up correctly/);
  });
});
