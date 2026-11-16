import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { generateCaseKey } from '../../domain/case/caseKey';
import { caseKeyFileText, CASE_KEY_FILE_NAME } from './caseKeyFile';
import { CaseKeyScreen } from './CaseKeyScreen';
import { submitErrorHeading, submitErrorMessage } from './submitCopy';

const KEY = generateCaseKey((length) => Uint8Array.from({ length }, (_, i) => i * 17 + 3));

function renderScreen(overrides: Partial<Parameters<typeof CaseKeyScreen>[0]> = {}) {
  const props = {
    caseKey: KEY,
    onFinish: vi.fn(),
    copyText: vi.fn(() => Promise.resolve(true)),
    download: vi.fn(),
    ...overrides,
  };
  render(<CaseKeyScreen {...props} />);
  return props;
}

describe('CaseKeyScreen', () => {
  it('shows the key once, in monospace groups of four', () => {
    renderScreen();
    const key = screen.getByTestId('case-key');
    expect(key).toHaveTextContent(/^(\w{4} ){5}\w{2}$/);
    expect(key.textContent?.replace(/ /g, '')).toBe(KEY);
    expect(key).toHaveClass('font-mono');
    expect(screen.getByText(/It is shown once/)).toBeVisible();
  });

  it('copies the bare key', async () => {
    const props = renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Copy key' }));
    expect(props.copyText).toHaveBeenCalledWith(KEY);
    expect(await screen.findByText('Copied.')).toBeVisible();
  });

  it('explains when copying is blocked', async () => {
    renderScreen({ copyText: vi.fn(() => Promise.resolve(false)) });
    await userEvent.click(screen.getByRole('button', { name: 'Copy key' }));
    expect(await screen.findByText(/Copying was blocked/)).toBeVisible();
  });

  it('downloads a .txt with the grouped key and where to use it', async () => {
    const props = renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Download .txt' }));
    expect(props.download).toHaveBeenCalledWith(
      CASE_KEY_FILE_NAME,
      caseKeyFileText(KEY, window.location.origin),
    );
    const text = caseKeyFileText(KEY, 'https://example.test');
    expect(text).toContain(KEY.slice(0, 4));
    expect(text).toContain('Follow up at https://example.test/case');
  });

  it('allows Done only after "I saved my key"', async () => {
    const props = renderScreen();
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'I saved my key somewhere safe' }));
    await userEvent.click(done);
    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });

  it('warns before the tab closes until the key is confirmed as saved', async () => {
    renderScreen();
    const unsaved = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unsaved);
    expect(unsaved.defaultPrevented).toBe(true);
    await userEvent.click(screen.getByRole('checkbox', { name: 'I saved my key somewhere safe' }));
    const saved = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(saved);
    expect(saved.defaultPrevented).toBe(false);
  });

  it('never writes the key to web storage', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Copy key' }));
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('says so in demo mode', () => {
    renderScreen({ demo: true });
    expect(screen.getByText('Demo mode: this case exists only in this tab.')).toBeVisible();
  });
});

describe('submit error copy', () => {
  it('offline says the report stays in this tab', () => {
    expect(submitErrorHeading('Offline')).toBe("You're offline");
    expect(submitErrorMessage('Offline')).toBe('Your report stays in this tab. Reconnect to send.');
  });

  it.each(['PermissionDenied', 'QuotaExceeded', 'Misconfigured', 'Unknown'] as const)(
    '%s never claims that nothing left the device',
    (kind) => {
      expect(submitErrorMessage(kind)).not.toMatch(/nothing was sent/i);
      expect(submitErrorMessage(kind)).toMatch(/stays in this tab/);
    },
  );

  it('an unconfirmed send says it may have arrived, never that it was not sent', () => {
    expect(submitErrorHeading('SubmitUnconfirmed')).toBe("We couldn't confirm your report arrived");
    expect(submitErrorMessage('SubmitUnconfirmed')).toBe(
      'It may have reached the organization. Your text stays in this tab.',
    );
  });

  it.each([
    'PermissionDenied',
    'QuotaExceeded',
    'Misconfigured',
    'InputTooLong',
    'Unknown',
  ] as const)('%s is a certain failure: the report was not sent', (kind) => {
    expect(submitErrorHeading(kind)).toBe("Your report wasn't sent");
  });
});
