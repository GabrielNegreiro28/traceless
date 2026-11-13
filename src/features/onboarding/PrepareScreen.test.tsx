import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PrepareScreen } from './PrepareScreen';

describe('PrepareScreen', () => {
  it('explains the one-time download and offers Prepare and Back', async () => {
    const onPrepare = vi.fn();
    const onBack = vi.fn();
    render(<PrepareScreen progress={null} onPrepare={onPrepare} onBack={onBack} />);
    expect(screen.getByText(/happens once/)).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Prepare private AI' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onPrepare).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows download progress and keeps the busy button focusable but inert', async () => {
    const onPrepare = vi.fn();
    render(<PrepareScreen progress={0.426} onPrepare={onPrepare} onBack={() => undefined} />);
    expect(screen.getByRole('progressbar', { name: 'Preparing private AI' })).toHaveAttribute(
      'aria-valuenow',
      '43',
    );
    expect(screen.getByText('Downloading: 43%')).toBeVisible();
    const button = screen.getByRole('button', { name: 'Prepare private AI' });
    button.focus();
    await userEvent.click(button);
    expect(onPrepare).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
