import { useSyncExternalStore } from 'react';
import type { LedgerEntry } from '../../application/ports/PrivacyLedger';
import { useServices } from '../../app/services/useServices';

/** The session's ledger entries, re-rendering on every new entry (read-only). */
export function usePrivacyLedger(): readonly LedgerEntry[] {
  const { privacyLedger } = useServices();
  return useSyncExternalStore(privacyLedger.subscribe, privacyLedger.entries);
}
