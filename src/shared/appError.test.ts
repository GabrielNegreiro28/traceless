import { describe, expect, it } from 'vitest';
import { APP_ERROR_KINDS, createAppError, isAppError, type AppErrorKind } from './appError';

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

  it('builds a PrivacyViolation that carries only a fixed message', () => {
    const error = createAppError('PrivacyViolation', { message: 'Result discarded.' });
    expect(error).toEqual({ kind: 'PrivacyViolation', message: 'Result discarded.' });
  });
});

describe('approval errors', () => {
  it('reports how many direct identifiers remain, without any text', () => {
    const error = createAppError('DirectIdentifierRemains', { message: 'Remove them.', count: 2 });
    expect(error).toEqual({ kind: 'DirectIdentifierRemains', message: 'Remove them.', count: 2 });
  });

  it('carries the unacknowledged risk level', () => {
    const error = createAppError('RiskNotAcknowledged', { message: 'Confirm.', level: 'HIGH' });
    expect(error.level).toBe('HIGH');
  });
});

describe('APP_ERROR_KINDS', () => {
  it('lists every AppError kind exactly once', () => {
    // A missing or extra key here is a compile error, so the list cannot drift.
    const everyKind: Record<AppErrorKind, true> = {
      OnDeviceUnavailable: true,
      LanguageNotSupported: true,
      ModelDownloading: true,
      InvalidModelOutput: true,
      Offline: true,
      QuotaExceeded: true,
      PermissionDenied: true,
      PrivacyViolation: true,
      OnDeviceStuck: true,
      InputTooLong: true,
      Misconfigured: true,
      DirectIdentifierRemains: true,
      RiskNotAcknowledged: true,
      EmptyReport: true,
      ApprovalMismatch: true,
      Cancelled: true,
      ContentBlocked: true,
      CloudScanDisabled: true,
      ConsentRequired: true,
      Unknown: true,
    };
    expect([...APP_ERROR_KINDS].sort()).toEqual(Object.keys(everyKind).sort());
    expect(new Set(APP_ERROR_KINDS).size).toBe(APP_ERROR_KINDS.length);
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
