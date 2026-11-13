/// <reference types="vite/client" />

// Typed environment: unknown VITE_* keys are a type error (read them only in src/app/env.ts).
interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
  /** Dev only; lives in the git-ignored .env.development.local. */
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_AI_MODE?: string;
  readonly VITE_USE_EMULATORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
