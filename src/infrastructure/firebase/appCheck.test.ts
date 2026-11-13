import type { FirebaseApp } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppCheck } from './appCheck';

const sdk = vi.hoisted(() => ({
  tokenAtInit: [] as unknown[],
  initializeAppCheck: vi.fn(),
  ReCaptchaEnterpriseProvider: vi.fn(),
}));

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: sdk.initializeAppCheck,
  ReCaptchaEnterpriseProvider: sdk.ReCaptchaEnterpriseProvider,
}));

const GLOBAL_KEY = 'FIREBASE_APPCHECK_DEBUG_TOKEN';

function fakeApp(): FirebaseApp {
  return { name: 'test' } as unknown as FirebaseApp;
}

function readGlobal(): unknown {
  return Reflect.get(self, GLOBAL_KEY);
}

describe('initAppCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.tokenAtInit.length = 0;
    Reflect.deleteProperty(self, GLOBAL_KEY);
    sdk.initializeAppCheck.mockImplementation(() => {
      sdk.tokenAtInit.push(readGlobal());
      return { kind: 'app-check' };
    });
  });

  it('uses reCAPTCHA Enterprise with auto refresh and no debug global', () => {
    initAppCheck(fakeApp(), { siteKey: 'site-key' });

    expect(sdk.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('site-key');
    expect(sdk.initializeAppCheck).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isTokenAutoRefreshEnabled: true }),
    );
    expect(readGlobal()).toBeUndefined();
  });

  it('sets the debug token global before initializing when one is passed', () => {
    initAppCheck(fakeApp(), { siteKey: 'site-key', debugToken: 'registered-token' });

    expect(sdk.tokenAtInit).toEqual(['registered-token']);
  });

  it('passes `true` through so the SDK can generate a token', () => {
    initAppCheck(fakeApp(), { siteKey: 'site-key', debugToken: true });

    expect(readGlobal()).toBe(true);
  });

  it('initializes only once per app', () => {
    const app = fakeApp();
    const first = initAppCheck(app, { siteKey: 'site-key' });
    const second = initAppCheck(app, { siteKey: 'site-key' });

    expect(second).toBe(first);
    expect(sdk.initializeAppCheck).toHaveBeenCalledTimes(1);
  });
});
