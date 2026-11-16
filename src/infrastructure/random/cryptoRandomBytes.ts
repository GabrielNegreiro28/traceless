import type { RandomBytes } from '../../domain/case/caseKey';

/** The CSPRNG behind case keys (ADR 0003): Web Crypto, never Math.random. */
export const cryptoRandomBytes: RandomBytes = (length) =>
  crypto.getRandomValues(new Uint8Array(length));
