import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFirebaseApp, type FirebaseWebConfig } from './app';

const sdk = vi.hoisted(() => ({
  apps: [] as unknown[],
  getApps: vi.fn(),
  getApp: vi.fn(),
  initializeApp: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApps: sdk.getApps,
  getApp: sdk.getApp,
  initializeApp: sdk.initializeApp,
}));

const CONFIG: FirebaseWebConfig = {
  apiKey: 'k',
  authDomain: 'd',
  projectId: 'p',
  storageBucket: 'b',
  messagingSenderId: 's',
  appId: 'a',
};

describe('getFirebaseApp', () => {
  beforeEach(() => {
    sdk.apps.length = 0;
    sdk.getApps.mockImplementation(() => sdk.apps);
    sdk.getApp.mockImplementation(() => sdk.apps[0]);
    sdk.initializeApp.mockImplementation(() => {
      const app = { name: '[DEFAULT]' };
      sdk.apps.push(app);
      return app;
    });
    sdk.initializeApp.mockClear();
  });

  it('is idempotent: initializes once and then reuses the default app', () => {
    const first = getFirebaseApp(CONFIG);
    const second = getFirebaseApp(CONFIG);

    expect(second).toBe(first);
    expect(sdk.initializeApp).toHaveBeenCalledTimes(1);
    expect(sdk.initializeApp).toHaveBeenCalledWith(CONFIG);
  });
});
