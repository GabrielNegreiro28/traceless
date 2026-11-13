import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes aria-valuenow as a percentage', () => {
    render(<ProgressBar label="Downloading" value={0.426} />);
    const bar = screen.getByRole('progressbar', { name: 'Downloading' });
    expect(bar).toHaveAttribute('aria-valuenow', '43');
  });

  it('clamps out-of-range values', () => {
    render(<ProgressBar label="Over" value={3} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('is indeterminate (no aria-valuenow) without a value', () => {
    render(<ProgressBar label="Working" />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });
});
