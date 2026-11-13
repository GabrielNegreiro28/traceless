import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { toRawText } from '../../domain/text/brandedText';
import { StallPanel, type StallPanelProps } from './StallPanel';

const TEXT = toRawText('I am the only night nurse on ward 7.');

function renderPanel(recoverable: boolean, overrides: Partial<StallPanelProps> = {}) {
  const props: StallPanelProps = {
    recoverable,
    text: TEXT,
    onTryAgain: vi.fn(),
    onBackToEdit: vi.fn(),
    onBasicChecks: vi.fn(),
    copyText: vi.fn(() => Promise.resolve(true)),
    reload: vi.fn(),
    ...overrides,
  };
  render(<StallPanel {...props} />);
  return props;
}

const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

describe('StallPanel, recoverable', () => {
  it('says the AI stalled and offers Try again and Back to edit', async () => {
    const props = renderPanel(true);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('On-device AI stalled');
    expect(screen.getByRole('alert')).toHaveTextContent(/nothing was sent anywhere/i);
    await click('Try again');
    expect(props.onTryAgain).toHaveBeenCalledOnce();
    await click('Back to edit');
    expect(props.onBackToEdit).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Continue with basic checks' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy my text and reload' })).toBeNull();
  });
});

describe('StallPanel, terminal', () => {
  it('offers basic checks (no Try again) and explains what they miss', async () => {
    const props = renderPanel(false);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "On-device AI isn't responding",
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByText(/role, shift or location are not checked/)).toBeVisible();
    await click('Continue with basic checks');
    expect(props.onBasicChecks).toHaveBeenCalledOnce();
  });

  it('copies the text, warns that reloading clears the draft, and reloads only on confirm', async () => {
    const props = renderPanel(false);
    await click('Copy my text and reload');
    expect(props.copyText).toHaveBeenCalledExactlyOnceWith(TEXT);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your text is copied. Reloading clears the draft from this page.',
    );
    expect(props.reload).not.toHaveBeenCalled();

    await click('Cancel');
    expect(props.reload).not.toHaveBeenCalled();
    await click('Copy my text and reload');
    await click('Reload now');
    expect(props.reload).toHaveBeenCalledOnce();
  });

  it('when the copy fails, shows the text for a manual copy and still asks before reloading', async () => {
    const props = renderPanel(false, { copyText: vi.fn(() => Promise.resolve(false)) });
    await click('Copy my text and reload');
    expect(await screen.findByText(/couldn't copy your text automatically/)).toBeVisible();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Your report text' }).value,
    ).toBe(TEXT);
    expect(props.reload).not.toHaveBeenCalled();
    await click('Reload now');
    expect(props.reload).toHaveBeenCalledOnce();
  });

  it('treats a rejected copy as a failed copy', async () => {
    renderPanel(false, { copyText: vi.fn(() => Promise.reject(new Error('denied'))) });
    await click('Copy my text and reload');
    expect(await screen.findByText(/couldn't copy your text automatically/)).toBeVisible();
  });
});
