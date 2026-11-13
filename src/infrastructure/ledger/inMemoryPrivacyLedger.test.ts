import { describe, expect, it, vi } from 'vitest';
import type { LedgerEntry } from '../../application/ports/PrivacyLedger';
import { createInMemoryPrivacyLedger } from './inMemoryPrivacyLedger';

const SCAN: LedgerEntry = {
  task: 'identityScan',
  source: 'onDevice',
  dataClass: 'RAW',
  demo: false,
  at: 1,
};

describe('createInMemoryPrivacyLedger', () => {
  it('starts empty and keeps the same snapshot until something is recorded', () => {
    const ledger = createInMemoryPrivacyLedger();
    expect(ledger.entries()).toEqual([]);
    expect(ledger.entries()).toBe(ledger.entries());
  });

  it('appends entries in order with a new frozen snapshot', () => {
    const ledger = createInMemoryPrivacyLedger();
    const before = ledger.entries();
    ledger.record(SCAN);
    ledger.record({ ...SCAN, task: 'approve', source: 'local', dataClass: 'SANITIZED', at: 2 });
    expect(ledger.entries()).not.toBe(before);
    expect(ledger.entries().map((e) => e.task)).toEqual(['identityScan', 'approve']);
    expect(Object.isFrozen(ledger.entries())).toBe(true);
    expect(Object.isFrozen(ledger.entries()[0])).toBe(true);
  });

  it('notifies subscribers until they unsubscribe', () => {
    const ledger = createInMemoryPrivacyLedger();
    const listener = vi.fn();
    const unsubscribe = ledger.subscribe(listener);
    ledger.record(SCAN);
    unsubscribe();
    ledger.record(SCAN);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('never touches browser storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    createInMemoryPrivacyLedger().record(SCAN);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
