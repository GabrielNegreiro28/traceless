import { describe, expect, it, vi } from 'vitest';
import { cryptoRandomBytes } from './cryptoRandomBytes';

describe('cryptoRandomBytes', () => {
  it('fills the requested number of bytes from crypto.getRandomValues', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    const bytes = cryptoRandomBytes(16);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes).toHaveLength(16);
    expect(spy).toHaveBeenCalledWith(bytes);
  });
});
