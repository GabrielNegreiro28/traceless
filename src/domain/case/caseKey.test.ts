import { describe, expect, it, vi } from 'vitest';
import {
  CASE_KEY_BYTES,
  CASE_KEY_LENGTH,
  generateCaseKey,
  groupCaseKey,
  parseCaseKey,
  type CaseKey,
  type RandomBytes,
} from './caseKey';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const fixedBytes =
  (fill: (index: number) => number): RandomBytes =>
  (length) =>
    Uint8Array.from({ length }, (_, index) => fill(index));

/** Independent decoder: base62 back to the integer. */
function decode(key: string): bigint {
  return [...key].reduce((value, char) => value * 62n + BigInt(ALPHABET.indexOf(char)), 0n);
}

function encodeBytes(bytes: number[]): bigint {
  return bytes.reduce((value, byte) => value * 256n + BigInt(byte), 0n);
}

describe('generateCaseKey', () => {
  it('asks the random source for exactly 128 bits', () => {
    const source = vi.fn(fixedBytes(() => 7));
    generateCaseKey(source);
    expect(source).toHaveBeenCalledWith(CASE_KEY_BYTES);
    expect(CASE_KEY_BYTES * 8).toBe(128);
  });

  it('encodes all-zero bytes as a fixed-length key of zeros', () => {
    expect(generateCaseKey(fixedBytes(() => 0))).toBe('0'.repeat(CASE_KEY_LENGTH));
  });

  it('encodes the largest 128-bit value in 22 base62 characters, losslessly', () => {
    const key = generateCaseKey(fixedBytes(() => 0xff));
    expect(key).toHaveLength(CASE_KEY_LENGTH);
    expect(decode(key)).toBe(2n ** 128n - 1n);
  });

  it('is deterministic for a given source and lossless for arbitrary bytes', () => {
    const bytes = Array.from({ length: 16 }, (_, i) => (i * 37 + 11) % 256);
    const source = fixedBytes((i) => bytes[i] ?? 0);
    const key = generateCaseKey(source);
    expect(generateCaseKey(source)).toBe(key);
    expect(key).toMatch(/^[0-9A-Za-z]{22}$/);
    expect(decode(key)).toBe(encodeBytes(bytes));
  });

  it('gives different keys for different bytes', () => {
    const a = generateCaseKey(fixedBytes(() => 1));
    const b = generateCaseKey(fixedBytes((i) => (i === 15 ? 2 : 1)));
    expect(a).not.toBe(b);
  });

  it('refuses a source that returns the wrong number of bytes', () => {
    expect(() => generateCaseKey(() => new Uint8Array(8))).toThrow(/expected 16/);
  });
});

describe('parseCaseKey', () => {
  const key = generateCaseKey(fixedBytes((i) => i * 13));

  it('accepts a key as generated', () => {
    expect(parseCaseKey(key)).toBe(key);
  });

  it('ignores the spaces and dashes of the grouped display', () => {
    expect(parseCaseKey(` ${groupCaseKey(key).join(' ')} `)).toBe(key);
    expect(parseCaseKey(groupCaseKey(key).join('-'))).toBe(key);
  });

  it.each(['', 'short', 'x'.repeat(23), `${'a'.repeat(21)}!`, `${'a'.repeat(21)}é`])(
    'rejects %j',
    (input) => {
      expect(parseCaseKey(input)).toBeNull();
    },
  );
});

describe('groupCaseKey', () => {
  it('splits into groups of four (the last group holds the remainder)', () => {
    const groups = groupCaseKey('0123456789ABCDEFGHIJKL' as CaseKey);
    expect(groups).toEqual(['0123', '4567', '89AB', 'CDEF', 'GHIJ', 'KL']);
  });
});
