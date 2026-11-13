import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createAppError, type AppError } from '../../shared/appError';
import { ApprovalErrorPanel } from './ApprovalErrorPanel';

function renderPanel(error: AppError) {
  const onBackToReview = vi.fn();
  const onBackToOutbox = vi.fn();
  render(
    <ApprovalErrorPanel
      error={error}
      onBackToReview={onBackToReview}
      onBackToOutbox={onBackToOutbox}
    />,
  );
  return { onBackToReview, onBackToOutbox };
}

describe('ApprovalErrorPanel', () => {
  it('an undecided direct identifier sends the reporter back to review', async () => {
    const spies = renderPanel(
      createAppError('DirectIdentifierRemains', { message: 'x', count: 1 }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A name, email, phone or ID is still undecided. Go back to review to decide it.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Back to review' }));
    expect(spies.onBackToReview).toHaveBeenCalledTimes(1);
  });

  it('an empty report sends the reporter back to review', async () => {
    const spies = renderPanel(createAppError('EmptyReport', { message: 'x' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/removed all of the text/);
    await userEvent.click(screen.getByRole('button', { name: 'Back to review' }));
    expect(spies.onBackToReview).toHaveBeenCalledTimes(1);
  });

  it('a missing acknowledgement returns to the approval step', async () => {
    const spies = renderPanel(
      createAppError('RiskNotAcknowledged', { message: 'x', level: 'MEDIUM' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/Tick the box to confirm/);
    await userEvent.click(screen.getByRole('button', { name: 'Back to approval' }));
    expect(spies.onBackToOutbox).toHaveBeenCalledTimes(1);
    expect(spies.onBackToReview).not.toHaveBeenCalled();
  });

  it('a text mismatch uses the general copy and goes back to review', () => {
    renderPanel(createAppError('ApprovalMismatch', { message: 'x' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/did not match the text you were shown/);
    expect(screen.getByRole('button', { name: 'Back to review' })).toBeVisible();
    expect(screen.getByText(/Nothing has been sent/)).toBeVisible();
  });
});
