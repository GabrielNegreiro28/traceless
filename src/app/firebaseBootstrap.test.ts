import { describe, expect, it } from 'vitest';
import type { AppEnv } from './env';
import {
  appCheckOptionsFor,
  EMULATOR_PROJECT_ID,
  firebaseConfigFor,
  shouldInitAppCheck,
} from './firebaseBootstrap';

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
