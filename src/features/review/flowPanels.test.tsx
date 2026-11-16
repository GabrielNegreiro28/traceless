import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { APP_ERROR_KINDS, createAppError } from '../../shared/appError';
import { cloudScanErrorMessage } from './cloudScanErrorMessages';
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

describe('FlowErrorPanel after a consented cloud scan', () => {
  it('never claims nothing was sent, and leads back to the options', async () => {
    const onTryAgain = vi.fn();
    render(
      <FlowErrorPanel
        error={createAppError('Unknown', { message: 'x' })}
        onTryAgain={onTryAgain}
        cloud
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Traceless kept nothing');
    expect(alert).not.toHaveTextContent(/Nothing was sent/i);
    await userEvent.click(screen.getByRole('button', { name: 'Back to the options' }));
    expect(onTryAgain).toHaveBeenCalledOnce();
  });

  it.each(APP_ERROR_KINDS)('has cloud copy for %s that never claims nothing left', (kind) => {
    const message = cloudScanErrorMessage(kind);
    expect(message.length).toBeGreaterThan(20);
    expect(message).not.toMatch(/guarantee/i);
    expect(message).not.toContain(kind);
    if (!['CloudScanDisabled', 'ConsentRequired'].includes(kind)) {
      expect(message).not.toMatch(/nothing was sent anywhere/i);
    }
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

describe('FlowErrorPanel later in a flow checked in the cloud', () => {
  it('says nothing reached the organization, never that nothing was sent anywhere', async () => {
    const onTryAgain = vi.fn();
    render(
      <FlowErrorPanel
        error={createAppError('Unknown', { message: 'x' })}
        onTryAgain={onTryAgain}
        afterCloud
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Nothing has been sent to the organization.');
    expect(alert).not.toHaveTextContent(/anywhere/);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onTryAgain).toHaveBeenCalledOnce();
  });
});
