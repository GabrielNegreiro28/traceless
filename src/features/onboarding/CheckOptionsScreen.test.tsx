import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_REPORT } from '../compose/sampleReport';
import { ENABLE_FLAG_URL } from './checkOptionsCopy';
import { CheckOptionsScreen } from './CheckOptionsScreen';

const COPIED = 'Address copied. Paste it into a new tab.';
const COPY_FAILED = "Couldn't copy automatically. Select the address and copy it.";

function renderScreen(copyText: (text: string) => Promise<boolean>, text = 'My own report.') {
  const handlers = { onCloudScan: vi.fn(), onBasicCheck: vi.fn(), onBack: vi.fn() };
  render(<CheckOptionsScreen text={text} cloud="enabled" copyText={copyText} {...handlers} />);
  return handlers;
}

const copyButton = () => screen.getByRole('button', { name: 'Copy address' });
const copies = () => Promise.resolve(true);

describe('CheckOptionsScreen', () => {
  it('never claims nothing was ever sent (it is also reached after a cloud check)', () => {
    renderScreen(copies);
    expect(screen.getByText(/Nothing leaves this device unless you choose/)).toBeVisible();
    expect(screen.queryByText(/Nothing has been sent anywhere/)).not.toBeInTheDocument();
  });

  it('offers the one-click sample check only for the unmodified sample', () => {
    renderScreen(copies, SAMPLE_REPORT);
    expect(screen.getByRole('button', { name: 'Check the sample in the cloud' })).toBeVisible();
  });

  it('runs the basic check and goes back from their own buttons', async () => {
    const handlers = renderScreen(copies);
    await userEvent.click(screen.getByRole('button', { name: 'Run the basic private check' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(handlers.onBasicCheck).toHaveBeenCalledOnce();
    expect(handlers.onBack).toHaveBeenCalledOnce();
    expect(handlers.onCloudScan).not.toHaveBeenCalled();
  });
});

describe('EnableOnDeviceSteps copy button', () => {
  it('copies the flag address and confirms it', async () => {
    const copyText = vi.fn(copies);
    renderScreen(copyText);
    await userEvent.click(copyButton());
    expect(copyText).toHaveBeenCalledExactlyOnceWith(ENABLE_FLAG_URL);
    expect(await screen.findByText(COPIED)).toBeVisible();
  });

  it.each([
    ['refuses', () => Promise.resolve(false)],
    ['throws', () => Promise.reject(new Error('denied'))],
  ])('asks to copy by hand when the clipboard %s', async (_label, copyText) => {
    renderScreen(copyText);
    await userEvent.click(copyButton());
    expect(await screen.findByText(COPY_FAILED)).toBeVisible();
    expect(screen.queryByText(COPIED)).not.toBeInTheDocument();
    expect(screen.getByText(ENABLE_FLAG_URL)).toBeVisible();
  });
});
