import type { FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';

export const FIRESTORE_EMULATOR_HOST = '127.0.0.1';
export const FIRESTORE_EMULATOR_PORT = 8080;

export type DbOptions = {
  readonly useEmulators: boolean;
};

const instances = new WeakMap<FirebaseApp, Firestore>();

/**
 * Returns the Firestore instance for the app (idempotent).
 *
 * The cache lives in memory only (ADR 0005): report text, messages and the
 * case key must never be written to IndexedDB on a possibly shared computer.
 * Trade-off: offline writes are queued only while the tab stays open.
 */
export function getDb(app: FirebaseApp, options: DbOptions): Firestore {
  const existing = instances.get(app);
  if (existing !== undefined) return existing;

  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  if (options.useEmulators) {
    connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
  }
  instances.set(app, db);
  return db;
}
