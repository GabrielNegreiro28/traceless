import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GEMINI_API_TERMS_URL, OWN_TEXT_ACK_LABEL } from './checkOptionsCopy';
import { CloudConsentDialog } from './CloudConsentDialog';

const confirmButton = () => screen.getByRole('button', { name: 'Check in the cloud' });
const checkbox = () => screen.getByRole('checkbox', { name: OWN_TEXT_ACK_LABEL });

function renderDialog() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const ui = (open: boolean) => (
    <CloudConsentDialog open={open} onConfirm={onConfirm} onCancel={onCancel} />
  );
  const view = render(ui(true));
  const setOpen = (open: boolean) => view.rerender(ui(open));
  return { onConfirm, onCancel, setOpen };
}

describe('CloudConsentDialog', () => {
  it('keeps the confirm button disabled until the box is ticked', async () => {
    const { onConfirm } = renderDialog();
    expect(checkbox()).not.toBeChecked();
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText('Tick the box to continue.')).toBeVisible();

    await userEvent.click(checkbox());
    expect(confirmButton()).toBeEnabled();
    await userEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('never confirms while the box is unticked, even when the form is submitted', async () => {
    const { onConfirm } = renderDialog();
    await userEvent.click(confirmButton());
    await userEvent.click(checkbox());
    await userEvent.click(checkbox());
    confirmButton().closest('form')?.requestSubmit();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('starts unticked again every time it reopens', async () => {
    const { setOpen } = renderDialog();
    await userEvent.click(checkbox());
    expect(checkbox()).toBeChecked();
    setOpen(false);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    setOpen(true);
    expect(checkbox()).not.toBeChecked();
    expect(confirmButton()).toBeDisabled();
  });

  it('cancels without confirming', async () => {
    const { onConfirm, onCancel } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('states the free-tier terms plainly and links them in a new tab', () => {
    renderDialog();
    expect(screen.getByText(/human reviewers may read it/)).toBeVisible();
    expect(screen.getByText(/Google may use your text to improve its products/)).toBeVisible();
    const link = screen.getByRole('link', { name: /Gemini API terms/ });
    expect(link).toHaveAttribute('href', GEMINI_API_TERMS_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
