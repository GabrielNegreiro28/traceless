import type { Auth } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnonymousAuthService } from './anonymousAuth';
import { mapFirebaseError } from './firebaseErrorMapper';

const sdk = vi.hoisted(() => ({ signInAnonymously: vi.fn() }));

vi.mock('firebase/auth', () => ({ signInAnonymously: sdk.signInAnonymously }));

const firebaseError = (code: string) => Object.assign(new Error('internal'), { code });

function fakeAuth(currentUser: unknown = null): Auth {
  return { currentUser } as unknown as Auth;
}

describe('createAnonymousAuthService', () => {
  beforeEach(() => {
    sdk.signInAnonymously.mockResolvedValue({ user: { uid: 'u1' } });
  });

  it('signs in anonymously when nobody is signed in', async () => {
    const auth = fakeAuth();
    const service = createAnonymousAuthService(() => auth);
    await expect(service.ensureSignedIn()).resolves.toEqual({ ok: true, value: undefined });
    expect(sdk.signInAnonymously).toHaveBeenCalledWith(auth);
  });

  it("reuses this tab's user", async () => {
    const service = createAnonymousAuthService(() => fakeAuth({ uid: 'u1' }));
    await service.ensureSignedIn();
    expect(sdk.signInAnonymously).not.toHaveBeenCalled();
  });

  it('does not touch Firebase until called', () => {
    const getAuth = vi.fn(() => fakeAuth());
    createAnonymousAuthService(getAuth);
    expect(getAuth).not.toHaveBeenCalled();
  });

  it.each([
    ['auth/network-request-failed', 'Offline'],
    ['auth/operation-not-allowed', 'Misconfigured'],
    ['auth/too-many-requests', 'QuotaExceeded'],
    ['auth/internal-error', 'Unknown'],
  ])('maps %s to %s', async (code, kind) => {
    sdk.signInAnonymously.mockRejectedValue(firebaseError(code));
    const service = createAnonymousAuthService(() => fakeAuth());
    await expect(service.ensureSignedIn()).resolves.toMatchObject({ ok: false, error: { kind } });
  });

  it('maps a failure to create the Auth instance to Unknown', async () => {
    const service = createAnonymousAuthService(() => {
      throw new Error('no app');
    });
    await expect(service.ensureSignedIn()).resolves.toMatchObject({
      ok: false,
      error: { kind: 'Unknown' },
    });
  });
});

describe('mapFirebaseError', () => {
  it.each([
    ['not-found', 'NotFound'],
    ['unauthenticated', 'PermissionDenied'],
    ['deadline-exceeded', 'Offline'],
  ])('maps %s to %s', (code, kind) => {
    expect(mapFirebaseError(firebaseError(code)).kind).toBe(kind);
  });

  it('never keeps the SDK error as cause', () => {
    expect(mapFirebaseError(firebaseError('unavailable'))).not.toHaveProperty('cause');
    expect(mapFirebaseError('weird').kind).toBe('Unknown');
  });
});
