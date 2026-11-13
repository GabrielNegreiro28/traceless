import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './pageActions';

function stubClipboard(clipboard: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
}

describe('copyToClipboard', () => {
  afterEach(() => {
    stubClipboard(undefined);
  });

  it('writes the text and reports success', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard({ writeText });
    await expect(copyToClipboard('my draft')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledExactlyOnceWith('my draft');
  });

  it('reports failure when the browser refuses', async () => {
    stubClipboard({ writeText: () => Promise.reject(new DOMException('no', 'NotAllowedError')) });
    await expect(copyToClipboard('my draft')).resolves.toBe(false);
  });

  it('reports failure when there is no clipboard API (insecure context)', async () => {
    stubClipboard(undefined);
    await expect(copyToClipboard('my draft')).resolves.toBe(false);
  });
});
