import { describe, expect, it } from 'vitest';
import { parseEnv, type EnvSource } from './env';

const VALID: EnvSource = {
  VITE_FIREBASE_API_KEY: 'api-key-value',
  VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'example-project',
  VITE_FIREBASE_STORAGE_BUCKET: 'example.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  VITE_FIREBASE_APP_ID: '1:1234567890:web:abc',
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: 'site-key-value',
};

describe('parseEnv', () => {
  it('builds the app environment with defaults', () => {
    const result = parseEnv(VALID);

    expect(result).toEqual({
      ok: true,
      value: {
        firebase: {
          apiKey: 'api-key-value',
          authDomain: 'example.firebaseapp.com',
          projectId: 'example-project',
          storageBucket: 'example.firebasestorage.app',
          messagingSenderId: '1234567890',
          appId: '1:1234567890:web:abc',
        },
        recaptchaSiteKey: 'site-key-value',
        aiMode: 'real',
        useEmulators: false,
      },
    });
  });

  it('reads the optional flags and the debug token', () => {
    const result = parseEnv({
      ...VALID,
      VITE_APPCHECK_DEBUG_TOKEN: 'debug-token-value',
      VITE_AI_MODE: 'fake',
      VITE_USE_EMULATORS: 'true',
    });

    expect(result.ok && result.value).toMatchObject({
      appCheckDebugToken: 'debug-token-value',
      aiMode: 'fake',
      useEmulators: true,
    });
  });

  it('ignores VITE_USE_EMULATORS outside dev unless AI is fake', () => {
    const on = { ...VALID, VITE_USE_EMULATORS: 'true' };

    expect(parseEnv(on, false)).toMatchObject({ value: { useEmulators: false } });
    expect(parseEnv(on, true)).toMatchObject({ value: { useEmulators: true } });
    expect(parseEnv({ ...on, VITE_AI_MODE: 'fake' }, false)).toMatchObject({
      value: { useEmulators: true },
    });
  });

  it('omits a blank debug token', () => {
    const result = parseEnv({ ...VALID, VITE_APPCHECK_DEBUG_TOKEN: '  ' });

    expect(result.ok && 'appCheckDebugToken' in result.value).toBe(false);
  });

  it('reports missing and blank variables by name', () => {
    const result = parseEnv({
      ...VALID,
      VITE_FIREBASE_API_KEY: undefined,
      VITE_FIREBASE_APP_ID: '',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      kind: 'Misconfigured',
      missing: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID'],
    });
  });

  it('never puts variable values in the error', () => {
    const result = parseEnv({
      ...VALID,
      VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: undefined,
      VITE_APPCHECK_DEBUG_TOKEN: 'secret-token-value',
      VITE_AI_MODE: 'not-a-mode-value',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const serialized = JSON.stringify(result.error);
    expect(serialized).not.toContain('secret-token-value');
    expect(serialized).not.toContain('not-a-mode-value');
    expect(serialized).not.toContain('api-key-value');
    expect(result.error.cause).toBeUndefined();
    expect(result.error).toMatchObject({
      missing: ['VITE_RECAPTCHA_ENTERPRISE_SITE_KEY', 'VITE_AI_MODE'],
    });
  });

  it('rejects an invalid emulator flag', () => {
    const result = parseEnv({ ...VALID, VITE_USE_EMULATORS: 'yes' });

    expect(!result.ok && result.error).toMatchObject({ missing: ['VITE_USE_EMULATORS'] });
  });
});
