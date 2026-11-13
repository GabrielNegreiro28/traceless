import type { FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';

export type AppCheckOptions = {
  /** reCAPTCHA Enterprise score-based web key. */
  readonly siteKey: string;
  /**
   * DEV ONLY. A registered debug token, or `true` to let the SDK print a new one
   * in the browser console. The caller decides when this is allowed
   * (see src/app/firebaseBootstrap.ts); it is never set in production builds.
   */
  readonly debugToken?: string | true;
};

const instances = new WeakMap<FirebaseApp, AppCheck>();

/** The SDK reads this global from `self` when App Check is initialized. */
function setDebugToken(token: string | true): void {
  Object.assign(self, { FIREBASE_APPCHECK_DEBUG_TOKEN: token });
}

/** Activates App Check once per app (idempotent); required by Firebase AI Logic. */
export function initAppCheck(app: FirebaseApp, options: AppCheckOptions): AppCheck {
  const existing = instances.get(app);
  if (existing !== undefined) return existing;

  if (options.debugToken !== undefined) setDebugToken(options.debugToken);
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(options.siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  instances.set(app, appCheck);
  return appCheck;
}
