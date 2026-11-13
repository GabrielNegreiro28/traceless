import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScanningScreen } from './ScanningScreen';

const REASSURANCE = 'About 10–20 seconds, running on this computer. Nothing is uploaded.';

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
    expect(screen.getByText('Checked 1 of 4 parts.')).toBeVisible();
  });

  it('uses the singular for a one-part report', () => {
    render(<ScanningScreen progress={{ done: 0, total: 1 }} onCancel={() => undefined} />);
    expect(screen.getByText('Checked 0 of 1 part.')).toBeVisible();
  });

  it('shows the on-device reassurance and announces progress in a polite live region', () => {
    render(<ScanningScreen progress={{ done: 1, total: 2 }} onCancel={() => undefined} />);
    expect(screen.getByText(REASSURANCE)).toBeVisible();
    expect(screen.getByText('Checked 1 of 2 parts.')).toHaveAttribute('aria-live', 'polite');
  });

  it('cancels from the Cancel button', async () => {
    const onCancel = vi.fn();
    render(<ScanningScreen progress={null} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
