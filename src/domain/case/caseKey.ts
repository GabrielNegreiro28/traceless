/**
 * The case key (ADR 0003): a capability URL in the form of a short string. Whoever holds it
 * can follow the case from any device, without an account. 128 random bits, base62-encoded,
 * fixed length. It is also the Firestore document id of the report.
 *
 * Pure: the random source is injected (the app passes `crypto.getRandomValues`), so tests are
 * deterministic.
 */
declare const caseKeyBrand: unique symbol;

export type CaseKey = string & { readonly [caseKeyBrand]: 'CaseKey' };

/** Returns `length` random bytes. Production MUST use a CSPRNG (crypto.getRandomValues). */
export type RandomBytes = (length: number) => Uint8Array;

/** 128 bits of entropy. */
export const CASE_KEY_BYTES = 16;

/** ceil(128 / log2(62)) = 22 base62 characters always hold 128 bits. */
export const CASE_KEY_LENGTH = 22;

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BigInt(ALPHABET.length);
const CASE_KEY_PATTERN = /^[0-9A-Za-z]{22}$/;
const GROUP_SIZE = 4;

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

/** Fixed-length base62, left-padded with '0' so every key has the same length. */
function toBase62(value: bigint): string {
  let digits = '';
  let rest = value;
  while (rest > 0n) {
    digits = ALPHABET.charAt(Number(rest % BASE)) + digits;
    rest /= BASE;
  }
  return digits.padStart(CASE_KEY_LENGTH, '0');
}

/** A new case key from 16 random bytes. A source that returns another length is a bug. */
export function generateCaseKey(randomBytes: RandomBytes): CaseKey {
  const bytes = randomBytes(CASE_KEY_BYTES);
  if (bytes.length !== CASE_KEY_BYTES) {
    throw new Error(`The random source returned ${String(bytes.length)} bytes, expected 16.`);
  }
  return toBase62(bytesToBigInt(bytes)) as CaseKey;
}

/**
 * Reads a key the reporter typed or pasted: spaces and dashes (from the grouped display) are
 * ignored; anything else must be exactly 22 base62 characters. Case-sensitive.
 */
export function parseCaseKey(input: string): CaseKey | null {
  const compact = input.replace(/[\s-]/g, '');
  return CASE_KEY_PATTERN.test(compact) ? (compact as CaseKey) : null;
}

/** Groups of four characters for display and the downloaded file ("AbC1 dEf2 ..."). */
export function groupCaseKey(key: CaseKey): readonly string[] {
  const groups: string[] = [];
  for (let start = 0; start < key.length; start += GROUP_SIZE) {
    groups.push(key.slice(start, start + GROUP_SIZE));
  }
  return groups;
}
