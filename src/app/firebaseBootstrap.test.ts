import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from './env';
import {
  appCheckOptionsFor,
  bootstrapFirebase,
  EMULATOR_PROJECT_ID,
  firebaseConfigFor,
  shouldInitAppCheck,
} from './firebaseBootstrap';

const mocks = vi.hoisted(() => ({
  app: { name: 'fake-app' },
  getFirebaseApp: vi.fn(),
  initAppCheck: vi.fn(),
}));

vi.mock('../infrastructure/firebase/app', () => ({ getFirebaseApp: mocks.getFirebaseApp }));
vi.mock('../infrastructure/firebase/appCheck', () => ({ initAppCheck: mocks.initAppCheck }));

const ENV: AppEnv = {
  firebase: {
    apiKey: 'k',
    authDomain: 'd',
    projectId: 'traceless-prod',
    storageBucket: 'b',
    messagingSenderId: 's',
    appId: 'a',
  },
  recaptchaSiteKey: 'site-key',
  aiMode: 'real',
  useEmulators: false,
};

describe('appCheckOptionsFor', () => {
  it('never passes a debug token outside dev, even if one is configured', () => {
    expect(appCheckOptionsFor({ ...ENV, appCheckDebugToken: 'tok' }, false)).toEqual({
      siteKey: 'site-key',
    });
  });

  it('uses the registered debug token in dev', () => {
    expect(appCheckOptionsFor({ ...ENV, appCheckDebugToken: 'tok' }, true)).toEqual({
      siteKey: 'site-key',
      debugToken: 'tok',
    });
  });

  it('asks the SDK to generate a token in dev when none is configured', () => {
    expect(appCheckOptionsFor(ENV, true)).toEqual({ siteKey: 'site-key', debugToken: true });
  });
});

describe('shouldInitAppCheck', () => {
  it.each([
    ['real', false, true],
    ['real', true, true],
    ['fake', false, true],
    ['fake', true, false],
  ] as const)('aiMode=%s useEmulators=%s -> %s', (aiMode, useEmulators, expected) => {
    expect(shouldInitAppCheck({ ...ENV, aiMode, useEmulators })).toBe(expected);
  });
});

describe('firebaseConfigFor', () => {
  it('keeps the real project id without emulators', () => {
    expect(firebaseConfigFor(ENV).projectId).toBe('traceless-prod');
  });

  it('forces the demo project id with emulators', () => {
    expect(firebaseConfigFor({ ...ENV, useEmulators: true }).projectId).toBe(EMULATOR_PROJECT_ID);
    expect(EMULATOR_PROJECT_ID).toBe('demo-traceless');
  });
});

describe('bootstrapFirebase', () => {
  beforeEach(() => {
    mocks.getFirebaseApp.mockReturnValue(mocks.app);
    mocks.getFirebaseApp.mockClear();
    mocks.initAppCheck.mockClear();
  });

  it('creates the app with the emulator project and skips App Check for fake AI', () => {
    const app = bootstrapFirebase({ ...ENV, aiMode: 'fake', useEmulators: true });

    expect(app).toBe(mocks.app);
    expect(mocks.getFirebaseApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: EMULATOR_PROJECT_ID }),
    );
    expect(mocks.initAppCheck).not.toHaveBeenCalled();
  });

  it('initializes App Check with the site key for real AI', () => {
    bootstrapFirebase(ENV);

    expect(mocks.initAppCheck).toHaveBeenCalledTimes(1);
    expect(mocks.initAppCheck).toHaveBeenCalledWith(
      mocks.app,
      expect.objectContaining({ siteKey: 'site-key' }),
    );
  });
});
