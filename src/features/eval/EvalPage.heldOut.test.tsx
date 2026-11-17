import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EvalScan } from '../../application/usecases/evaluateDetection';
import { EvalPage } from './EvalPage';
import { EvalServicesProvider } from './EvalServicesContext';
import type { EvalServices } from './evalServices';
import { DEFAULT_EVAL_VARIANT } from './evalVariants';
import { EMPTY_SCAN, fakeServices, TEST_DATASET } from './evalTestKit';

function renderPage(services: EvalServices) {
  render(
    <EvalServicesProvider services={services}>
      <EvalPage />
    </EvalServicesProvider>,
  );
}

const button = (name: RegExp) => screen.getByRole('button', { name });
const input = () => screen.getByLabelText(/Confirm the held-out v2 test/);

function countingServices() {
  const counter = { calls: 0 };
  const scan: EvalScan = (text) => {
    counter.calls += 1;
    return EMPTY_SCAN(text);
  };
  const v2TestDataset = {
    ...TEST_DATASET,
    reports: TEST_DATASET.reports.map((r) => ({ ...r, split: 'test' as const })),
  };
  const services = fakeServices({ scanFor: () => scan, v2TestDataset });
  return { services, counter };
}

describe('EvalPage held-out v2 test guard', () => {
  it('blocks preset 8 until the exact variant id is typed, and runs nothing meanwhile', async () => {
    const { services, counter } = countingServices();
    renderPage(services);
    await screen.findByText(/On-device AI is ready/);

    expect(button(/8\. Final v2 test/)).toBeDisabled();
    await userEvent.type(input(), 'not-the-id');
    expect(button(/8\. Final v2 test/)).toBeDisabled();
    await userEvent.click(button(/8\. Final v2 test/));

    expect(counter.calls).toBe(0);
  });

  it('starts preset 8 once the selected variant id is typed exactly', async () => {
    const { services, counter } = countingServices();
    renderPage(services);
    await screen.findByText(/On-device AI is ready/);

    await userEvent.type(input(), DEFAULT_EVAL_VARIANT.id);
    expect(button(/8\. Final v2 test/)).toBeEnabled();
    await userEvent.click(button(/8\. Final v2 test/));

    expect(await screen.findAllByText(/Saved to eval\/results/)).not.toHaveLength(0);
    expect(counter.calls).toBeGreaterThan(0);
  });

  it('does not affect the other presets', async () => {
    const { services, counter } = countingServices();
    renderPage(services);
    await screen.findByText(/On-device AI is ready/);

    expect(button(/1\. Smoke test/)).toBeEnabled();
    await userEvent.click(button(/1\. Smoke test/));

    expect(await screen.findByText('Saved to eval/results/saved-file.json')).toBeInTheDocument();
    expect(counter.calls).toBe(1);
  });
});
