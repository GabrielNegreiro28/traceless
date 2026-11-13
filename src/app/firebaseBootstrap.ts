import type { FirebaseApp } from 'firebase/app';
import { getFirebaseApp, type FirebaseWebConfig } from '../infrastructure/firebase/app';
import { initAppCheck, type AppCheckOptions } from '../infrastructure/firebase/appCheck';
import { isDev, type AppEnv } from './env';

/**
 * Firebase start-up sequence. The composition root calls `bootstrapFirebase(env)` when it
 * builds the real (non-fake) AI services.
 */

/** Emulators run under a `demo-` project, so they can never touch production. */
export const EMULATOR_PROJECT_ID = 'demo-traceless';

export function firebaseConfigFor(env: AppEnv): FirebaseWebConfig {
  return env.useEmulators ? { ...env.firebase, projectId: EMULATOR_PROJECT_ID } : env.firebase;
}

/** CI/E2E (fake AI + emulators) never calls AI Logic, so App Check is skipped. */
export function shouldInitAppCheck(env: AppEnv): boolean {
  return !(env.aiMode === 'fake' && env.useEmulators);
}

/** The debug token is only ever used in dev builds. */
export function appCheckOptionsFor(env: AppEnv, dev: boolean): AppCheckOptions {
  let debugToken: string | true | undefined;
  if (dev) {
    debugToken = env.appCheckDebugToken ?? true;
  }
  return debugToken === undefined
    ? { siteKey: env.recaptchaSiteKey }
    : { siteKey: env.recaptchaSiteKey, debugToken };
}

export function bootstrapFirebase(env: AppEnv): FirebaseApp {
  const app = getFirebaseApp(firebaseConfigFor(env));
  if (shouldInitAppCheck(env)) initAppCheck(app, appCheckOptionsFor(env, isDev));
  return app;
}
