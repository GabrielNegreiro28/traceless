import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

/** Firebase web app config. It identifies the project; it is not a secret. */
export type FirebaseWebConfig = {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
  readonly appId: string;
};

/** Returns the default Firebase app, creating it on the first call (idempotent). */
export function getFirebaseApp(config: FirebaseWebConfig): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp({ ...config });
}
