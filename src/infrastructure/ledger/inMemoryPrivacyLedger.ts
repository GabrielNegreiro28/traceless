import type { LedgerEntry, PrivacyLedger } from '../../application/ports/PrivacyLedger';

/**
 * PrivacyLedger kept in this tab's memory only: no storage of any kind, gone on reload.
 * Each record replaces the frozen list, so a snapshot never changes under a reader.
 */
export function createInMemoryPrivacyLedger(): PrivacyLedger {
  let entries: readonly LedgerEntry[] = Object.freeze([]);
  const listeners = new Set<() => void>();
  return {
    entries: () => entries,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    record: (entry) => {
      entries = Object.freeze([...entries, Object.freeze({ ...entry })]);
      for (const listener of [...listeners]) listener();
    },
  };
}
