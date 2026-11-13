import type { FirebaseApp } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from './firestore';

const sdk = vi.hoisted(() => {
  const memoryCache = { kind: 'memory' };
  return {
    memoryCache,
    memoryLocalCache: vi.fn(() => memoryCache),
    persistentLocalCache: vi.fn(),
    initializeFirestore: vi.fn(() => ({ kind: 'firestore' })),
    connectFirestoreEmulator: vi.fn(),
  };
});

vi.mock('firebase/firestore', () => sdk);

function fakeApp(): FirebaseApp {
  return { name: 'test' } as unknown as FirebaseApp;
}

describe('getDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the in-memory cache, never a persistent one', () => {
    const app = fakeApp();
    getDb(app, { useEmulators: false });

    expect(sdk.initializeFirestore).toHaveBeenCalledWith(app, { localCache: sdk.memoryCache });
    expect(sdk.persistentLocalCache).not.toHaveBeenCalled();
  });

  it('does not connect the emulator unless flagged', () => {
    getDb(fakeApp(), { useEmulators: false });

    expect(sdk.connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it('connects the local emulator when flagged', () => {
    const db = getDb(fakeApp(), { useEmulators: true });

    expect(sdk.connectFirestoreEmulator).toHaveBeenCalledWith(db, '127.0.0.1', 8080);
  });

  it('initializes only once per app', () => {
    const app = fakeApp();
    const first = getDb(app, { useEmulators: true });
    const second = getDb(app, { useEmulators: true });

    expect(second).toBe(first);
    expect(sdk.initializeFirestore).toHaveBeenCalledTimes(1);
    expect(sdk.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
  });
});
