import { signInAnonymously, type Auth } from 'firebase/auth';
import type { AuthService } from '../../application/ports/AuthService';
import { logger } from '../../shared/logger';
import { err, ok } from '../../shared/result';
import { mapFirebaseError } from './firebaseErrorMapper';

/**
 * AuthService over Firebase anonymous sign-in. `getAuth` is called on first use only, so
 * Firebase is never touched before the reporter sends or looks up a case. The Auth instance
 * keeps the identity in memory (auth.ts, ADR 0005): closing the tab forgets it.
 */
export function createAnonymousAuthService(getAuth: () => Auth): AuthService {
  return {
    ensureSignedIn: async () => {
      try {
        const auth = getAuth();
        if (auth.currentUser === null) await signInAnonymously(auth);
        return ok(undefined);
      } catch (error) {
        const mapped = mapFirebaseError(error);
        logger.warn('Anonymous sign-in failed', { kind: mapped.kind });
        return err(mapped);
      }
    },
  };
}
