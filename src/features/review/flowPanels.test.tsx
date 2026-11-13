import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { APP_ERROR_KINDS, createAppError } from '../../shared/appError';
import { ConsentPlaceholder } from './ConsentPlaceholder';
import { FlowErrorPanel } from './FlowErrorPanel';
import { ReviewPlaceholder } from './ReviewPlaceholder';

describe('FlowErrorPanel', () => {
  it('shows a friendly alert for the error kind and retries', async () => {
    const onTryAgain = vi.fn();
    render(
      <FlowErrorPanel
        error={createAppError('Offline', { message: 'x' })}
        onTryAgain={onTryAgain}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/offline/i);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onTryAgain).toHaveBeenCalledOnce();
  });

  it('never shows the developer message', () => {
    const error = createAppError('Unknown', { message: 'secret developer detail' });
    render(<FlowErrorPanel error={error} onTryAgain={() => undefined} />);
    expect(screen.queryByText(/secret developer detail/)).not.toBeInTheDocument();
    expect(APP_ERROR_KINDS).toContain(error.kind);
  });
});

describe('ConsentPlaceholder', () => {
  it('explains that cloud scanning needs consent and goes back', async () => {
    const onBack = vi.fn();
    render(<ConsentPlaceholder onBack={onBack} />);
    expect(
      screen.getByText(
        "On-device AI isn't available in this browser. Cloud scanning with your consent is coming next.",
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('ReviewPlaceholder', () => {
  it.each([
    [0, '0 details found'],
    [1, '1 detail found'],
    [7, '7 details found'],
  ])('with %d findings says "%s" and offers Back to edit', async (count, text) => {
    const onBackToEdit = vi.fn();
    render(<ReviewPlaceholder findingCount={count} onBackToEdit={onBackToEdit} />);
    expect(screen.getByText(text)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(onBackToEdit).toHaveBeenCalledOnce();
  });
});
