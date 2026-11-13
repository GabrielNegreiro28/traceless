import type { FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, inMemoryPersistence, initializeAuth, type Auth } from 'firebase/auth';

export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

export type AuthServiceOptions = {
  readonly useEmulators: boolean;
};

const instances = new WeakMap<FirebaseApp, Auth>();

/**
 * Returns the Auth instance for the app (idempotent).
 *
 * Persistence is in memory only (ADR 0005): a whistleblower may be on a shared
 * or work computer, so no identity may survive in IndexedDB/localStorage after
 * the tab closes.
 */
export function getAuthService(app: FirebaseApp, options: AuthServiceOptions): Auth {
  const existing = instances.get(app);
  if (existing !== undefined) return existing;

  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  if (options.useEmulators) connectAuthEmulator(auth, AUTH_EMULATOR_URL);
  instances.set(app, auth);
  return auth;
}
