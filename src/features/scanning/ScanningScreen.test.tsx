import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScanningScreen } from './ScanningScreen';

const REASSURANCE = 'Usually 15–40 seconds, running on this computer. Nothing is uploaded.';

describe('ScanningScreen', () => {
  it('shows an indeterminate bar until the total is known', () => {
    render(<ScanningScreen progress={null} onCancel={() => undefined} />);
    const bar = screen.getByRole('progressbar', { name: 'Checking your report' });
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText('Getting ready to read your report.')).toBeVisible();
  });

  it('drives the bar from the chunk progress', () => {
    render(<ScanningScreen progress={{ done: 1, total: 4 }} onCancel={() => undefined} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('Finished 1 of 4 steps.')).toBeVisible();
  });

  it('uses the singular for a one-step scan', () => {
    render(<ScanningScreen progress={{ done: 0, total: 1 }} onCancel={() => undefined} />);
    expect(screen.getByText('Finished 0 of 1 step.')).toBeVisible();
  });

  it('shows the on-device reassurance and announces progress in a polite live region', () => {
    render(<ScanningScreen progress={{ done: 1, total: 2 }} onCancel={() => undefined} />);
    expect(screen.getByText(REASSURANCE)).toBeVisible();
    expect(screen.getByText('Finished 1 of 2 steps.')).toHaveAttribute('aria-live', 'polite');
  });

  it('cancels from the Cancel button', async () => {
    const onCancel = vi.fn();
    render(<ScanningScreen progress={null} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('says the cloud check runs as agreed in cloud mode', () => {
    render(<ScanningScreen progress={null} onCancel={() => undefined} mode="consentedCloud" />);
    expect(screen.getByText(/Checking in the cloud, as you agreed/)).toBeVisible();
  });

  it('never claims a cloud check in demo mode: nothing leaves the device', () => {
    render(
      <ScanningScreen progress={null} onCancel={() => undefined} mode="consentedCloud" demo />,
    );
    expect(screen.getByText(/Demo mode: .*Nothing leaves this device\./)).toBeVisible();
    expect(screen.queryByText(/as you agreed/)).not.toBeInTheDocument();
  });
});
