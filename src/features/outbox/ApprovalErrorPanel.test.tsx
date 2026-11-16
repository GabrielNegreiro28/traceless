import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createAppError, type AppErrorKind } from '../../shared/appError';
import { ApprovalErrorPanel } from './ApprovalErrorPanel';
import { approvalErrorCopy } from './outboxCopy';

function renderPanel(kind: AppErrorKind, cloud?: boolean) {
  const handlers = { onBackToReview: vi.fn(), onBackToOutbox: vi.fn() };
  render(
    <ApprovalErrorPanel
      error={createAppError(kind, { message: 'developer detail' })}
      {...(cloud === undefined ? {} : { cloud })}
      {...handlers}
    />,
  );
  return handlers;
}

describe('ApprovalErrorPanel', () => {
  it('reassures that the text is still only in this tab after an on-device check', () => {
    renderPanel('RiskNotAcknowledged');
    expect(
      screen.getByText('Nothing has been sent. Your text is still only in this tab.'),
    ).toBeVisible();
  });

  it('never claims the text stayed in this tab after a cloud check', async () => {
    const { onBackToOutbox } = renderPanel('RiskNotAcknowledged', true);
    expect(screen.getByText('Nothing has been sent to the organization.')).toBeVisible();
    expect(screen.queryByText(/only in this tab/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to approval' }));
    expect(onBackToOutbox).toHaveBeenCalledOnce();
  });

  it.each<AppErrorKind>(['ApprovalMismatch', 'Unknown'])(
    'uses cloud-safe fallback copy for %s after a cloud check',
    async (kind) => {
      const { onBackToReview } = renderPanel(kind, true);
      const alert = screen.getByRole('alert');
      expect(alert).not.toHaveTextContent(/anywhere/);
      expect(alert).toHaveTextContent('Nothing has been sent to the organization.');
      expect(screen.queryByText(/developer detail/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Back to review' }));
      expect(onBackToReview).toHaveBeenCalledOnce();
    },
  );
});

describe('approvalErrorCopy', () => {
  it('keeps the specific approval copy in both modes', () => {
    expect(approvalErrorCopy('EmptyReport', true)).toEqual(approvalErrorCopy('EmptyReport'));
  });

  it('keeps the on-device fallback unchanged', () => {
    expect(approvalErrorCopy('ApprovalMismatch').message).toMatch(/Nothing was sent anywhere/);
  });
});
