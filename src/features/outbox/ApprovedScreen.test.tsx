import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { approved } from '../review/reportFlowTestKit';
import { ApprovedScreen } from './ApprovedScreen';

describe('ApprovedScreen', () => {
  it('shows the approved text read-only with the on-device label', () => {
    const state = approved();
    render(<ApprovedScreen state={state} onBack={vi.fn()} />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Approved. This is what the organization will receive.',
      }),
    ).toBeVisible();
    expect(screen.getByText(state.report.text)).toBeVisible();
    expect(screen.getByText('Checked on your device')).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps Send report disabled with a note about the next version', () => {
    render(<ApprovedScreen state={approved()} onBack={vi.fn()} />);
    const send = screen.getByRole('button', { name: 'Send report' });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription('Sending arrives in the next version.');
  });

  it('Back discards the approval', async () => {
    const onBack = vi.fn();
    render(<ApprovedScreen state={approved()} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
