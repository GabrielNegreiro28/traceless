import type { FirebaseApp } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_EMULATOR_URL, getAuthService } from './auth';

const sdk = vi.hoisted(() => ({
  inMemoryPersistence: { type: 'NONE' },
  initializeAuth: vi.fn(() => ({ kind: 'auth' })),
  connectAuthEmulator: vi.fn(),
}));

vi.mock('firebase/auth', () => sdk);

function fakeApp(): FirebaseApp {
  return { name: 'test' } as unknown as FirebaseApp;
}

describe('getAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the identity in memory only', () => {
    const app = fakeApp();
    getAuthService(app, { useEmulators: false });

    expect(sdk.initializeAuth).toHaveBeenCalledWith(app, {
      persistence: sdk.inMemoryPersistence,
    });
  });

  it('does not connect the emulator unless flagged', () => {
    getAuthService(fakeApp(), { useEmulators: false });

    expect(sdk.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('connects the local emulator when flagged', () => {
    const auth = getAuthService(fakeApp(), { useEmulators: true });

    expect(AUTH_EMULATOR_URL).toBe('http://127.0.0.1:9099');
    expect(sdk.connectAuthEmulator).toHaveBeenCalledWith(auth, AUTH_EMULATOR_URL);
  });

  it('initializes only once per app', () => {
    const app = fakeApp();
    const first = getAuthService(app, { useEmulators: true });
    const second = getAuthService(app, { useEmulators: true });

    expect(second).toBe(first);
    expect(sdk.initializeAuth).toHaveBeenCalledTimes(1);
    expect(sdk.connectAuthEmulator).toHaveBeenCalledTimes(1);
  });
});
