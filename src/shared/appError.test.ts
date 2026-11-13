import { describe, expect, it } from 'vitest';
import { APP_ERROR_KINDS, createAppError, isAppError } from './appError';

describe('createAppError', () => {
  it('builds a simple variant', () => {
    expect(createAppError('Offline', { message: 'No network' })).toEqual({
      kind: 'Offline',
      message: 'No network',
    });
  });

  it('keeps variant-specific fields and the cause', () => {
    const cause = new Error('NotSupportedError');
    const error = createAppError('LanguageNotSupported', {
      message: 'Unsupported language',
      language: 'pt',
      cause,
    });

    expect(error.kind).toBe('LanguageNotSupported');
    expect(error.language).toBe('pt');
    expect(error.cause).toBe(cause);
  });

  it('lists the misconfigured variable names', () => {
    const error = createAppError('Misconfigured', {
      message: 'Missing environment variables',
      missing: ['VITE_FIREBASE_API_KEY'],
    });
    expect(error.missing).toEqual(['VITE_FIREBASE_API_KEY']);
  });

  it('allows an unknown download progress', () => {
    const error = createAppError('ModelDownloading', { message: 'Downloading', progress: null });
    expect(error.progress).toBeNull();
  });
});

describe('isAppError', () => {
  it.each(APP_ERROR_KINDS)('accepts the %s variant', (kind) => {
    expect(isAppError({ kind, message: 'x' })).toBe(true);
  });

  it.each([
    null,
    undefined,
    'Offline',
    42,
    {},
    { kind: 'Offline' },
    { kind: 'Nope', message: 'x' },
  ])('rejects %j', (value) => {
    expect(isAppError(value)).toBe(false);
  });
});
