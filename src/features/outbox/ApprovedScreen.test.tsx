import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { approved, submitting } from '../review/reportFlowTestKit';
import { ApprovedScreen } from './ApprovedScreen';

describe('ApprovedScreen', () => {
  it('shows the approved text read-only with the on-device label', () => {
    const state = approved();
    render(<ApprovedScreen state={state} onBack={vi.fn()} onSend={vi.fn()} />);
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

  it('sends on "Send to organization" and explains what is sent', async () => {
    const onSend = vi.fn();
    render(<ApprovedScreen state={approved()} onBack={vi.fn()} onSend={onSend} />);
    const send = screen.getByRole('button', { name: 'Send to organization' });
    expect(send).toBeEnabled();
    expect(send).toHaveAccessibleDescription(
      'Only this text is sent. You will get a case key to follow up, no account needed.',
    );
    await userEvent.click(send);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('while sending: busy button, Back disabled, clicks ignored', async () => {
    const onSend = vi.fn();
    render(<ApprovedScreen state={submitting()} onBack={vi.fn()} onSend={onSend} />);
    const send = screen.getByRole('button', { name: /Sending/ });
    expect(send).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await userEvent.click(send);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('says in demo mode that the report stays in this tab', () => {
    render(<ApprovedScreen state={approved()} onBack={vi.fn()} onSend={vi.fn()} demo />);
    expect(screen.getByText(/Demo mode: the report stays in this tab/)).toBeVisible();
  });

  it('Back discards the approval', async () => {
    const onBack = vi.fn();
    render(<ApprovedScreen state={approved()} onBack={onBack} onSend={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
