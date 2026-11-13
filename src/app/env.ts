import { z } from 'zod';
import type { FirebaseWebConfig } from '../infrastructure/firebase/app';
import { createAppError, type AppError } from '../shared/appError';
import { err, ok, type Result } from '../shared/result';

/**
 * The ONLY module that reads `import.meta.env` (enforced by ESLint).
 * Variables are read one by one, never as the whole `import.meta.env` object,
 * so the bundler inlines exactly these values and nothing else.
 */

export type AiMode = 'real' | 'fake';

export type AppEnv = {
  readonly firebase: FirebaseWebConfig;
  readonly recaptchaSiteKey: string;
  /** Dev only; undefined in production builds. */
  readonly appCheckDebugToken?: string;
  readonly aiMode: AiMode;
  readonly useEmulators: boolean;
};

export type EnvSource = Readonly<Record<string, string | undefined>>;

/** True in `vite dev`, false in production builds (statically replaced by Vite). */
export const isDev: boolean = import.meta.env.DEV;

const required = z.string().trim().min(1);

const ENV_SCHEMA = z.object({
  VITE_FIREBASE_API_KEY: required,
  VITE_FIREBASE_AUTH_DOMAIN: required,
  VITE_FIREBASE_PROJECT_ID: required,
  VITE_FIREBASE_STORAGE_BUCKET: required,
  VITE_FIREBASE_MESSAGING_SENDER_ID: required,
  VITE_FIREBASE_APP_ID: required,
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: required,
  VITE_APPCHECK_DEBUG_TOKEN: required.optional(),
  VITE_AI_MODE: z.enum(['real', 'fake']).default('real'),
  VITE_USE_EMULATORS: z.enum(['true', 'false']).default('false'),
});

type ParsedEnv = z.infer<typeof ENV_SCHEMA>;

/** Blank values (as left by copying .env.example) count as unset. */
function dropBlankValues(source: EnvSource): EnvSource {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value?.trim() === '' ? undefined : value]),
  );
}

function toAppEnv(parsed: ParsedEnv): AppEnv {
  const token = parsed.VITE_APPCHECK_DEBUG_TOKEN;
  return {
    firebase: {
      apiKey: parsed.VITE_FIREBASE_API_KEY,
      authDomain: parsed.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: parsed.VITE_FIREBASE_PROJECT_ID,
      storageBucket: parsed.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: parsed.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: parsed.VITE_FIREBASE_APP_ID,
    },
    recaptchaSiteKey: parsed.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
    ...(token === undefined ? {} : { appCheckDebugToken: token }),
    aiMode: parsed.VITE_AI_MODE,
    useEmulators: parsed.VITE_USE_EMULATORS === 'true',
  };
}

/**
 * Validates raw env values. The error lists variable NAMES only; values never
 * appear in it (and the zod error is not attached as `cause`).
 */
export function parseEnv(source: EnvSource): Result<AppEnv, AppError> {
  const parsed = ENV_SCHEMA.safeParse(dropBlankValues(source));
  if (parsed.success) return ok(toAppEnv(parsed.data));

  const missing = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  return err(
    createAppError('Misconfigured', {
      message: `Missing or invalid environment variables: ${missing.join(', ')}`,
      missing,
    }),
  );
}

/** Reads the build-time environment, variable by variable. */
export function readEnv(): Result<AppEnv, AppError> {
  return parseEnv({
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
    // `DEV` is a literal `false` in production builds, so the bundler drops the
    // token entirely (guarded by scripts/verify-no-debug-token.mjs).
    VITE_APPCHECK_DEBUG_TOKEN: import.meta.env.DEV
      ? import.meta.env.VITE_APPCHECK_DEBUG_TOKEN
      : undefined,
    VITE_AI_MODE: import.meta.env.VITE_AI_MODE,
    VITE_USE_EMULATORS: import.meta.env.VITE_USE_EMULATORS,
  });
}
