import { logger } from '../shared/logger';
import { createServices, type Services } from './compositionRoot';
import { readEnv } from './env';

export interface BootstrapDeps {
  readonly readEnv: typeof readEnv;
  readonly createServices: typeof createServices;
}

const DEFAULT_DEPS: BootstrapDeps = { readEnv, createServices };

/**
 * Builds the app services once at start-up. Returns null (after logging the failure kind
 * only) when the configuration is invalid or when building the services throws, so the
 * caller can render one fallback instead of a blank page.
 */
export function bootstrapServices(deps: BootstrapDeps = DEFAULT_DEPS): Services | null {
  const env = deps.readEnv();
  if (!env.ok) {
    logger.error('App configuration is invalid', { kind: env.error.kind });
    return null;
  }
  try {
    return deps.createServices(env.value);
  } catch {
    logger.error('App bootstrap failed', { kind: 'bootstrap' });
    return null;
  }
}
