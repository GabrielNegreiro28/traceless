import type { FirebaseApp } from 'firebase/app';
import {
  fetchAndActivate,
  getBoolean,
  isSupported,
  type RemoteConfig,
} from 'firebase/remote-config';
import {
  DEFAULT_APP_CONFIG,
  type AppConfig,
  type ConfigService,
} from '../../application/ports/ConfigService';
import { logger } from '../../shared/logger';
import { withDeadline } from '../ai/deadline';
import { getRemoteConfigService } from '../firebase/remoteConfig';
import type { RemoteConfigKey } from '../firebase/remoteConfigDefaults';

export interface RemoteConfigServiceOptions {
  /** Upper bound for the first fetch; past it the defaults (or cached values) are used. */
  readonly timeoutMs: number;
  /** How long fetched values are reused before the SDK fetches again. */
  readonly minimumFetchIntervalMs: number;
}

/** Short, so a slow network never holds up the reporter's choice screen. */
export const REMOTE_CONFIG_OPTIONS: RemoteConfigServiceOptions = {
  timeoutMs: 3_000,
  minimumFetchIntervalMs: 60 * 60 * 1000,
};

const CLOUD_SCAN_ENABLED: RemoteConfigKey = 'cloud_scan_enabled';

function readAppConfig(remoteConfig: RemoteConfig): AppConfig {
  return { cloudScanEnabled: getBoolean(remoteConfig, CLOUD_SCAN_ENABLED) };
}

/** The Remote Config instance with defaults and settings, or null where it cannot run. */
async function prepare(
  getApp: () => FirebaseApp,
  options: RemoteConfigServiceOptions,
): Promise<RemoteConfig | null> {
  if (!(await isSupported())) return null;
  const remoteConfig = getRemoteConfigService(getApp());
  remoteConfig.settings.fetchTimeoutMillis = options.timeoutMs;
  remoteConfig.settings.minimumFetchIntervalMillis = options.minimumFetchIntervalMs;
  return remoteConfig;
}

/** Fetches and activates once, within the deadline; failures only cost the fresh values. */
async function fetchWithin(remoteConfig: RemoteConfig, timeoutMs: number): Promise<void> {
  const fetched = fetchAndActivate(remoteConfig).then(
    () => true,
    () => false,
  );
  const done = await withDeadline(fetched, timeoutMs, () => false);
  if (!done)
    logger.warn('Remote Config fetch failed or timed out; using defaults or cached values');
}

/**
 * ConfigService over Firebase Remote Config (PLANO §3.5). The first `load()` fetches with a
 * short deadline; every `load()` then reads the activated values, which fall back to the
 * in-code defaults (remoteConfigDefaults.ts) when nothing was fetched. Never rejects.
 */
export function createRemoteConfigService(
  getApp: () => FirebaseApp,
  options: RemoteConfigServiceOptions = REMOTE_CONFIG_OPTIONS,
): ConfigService {
  let ready: Promise<RemoteConfig | null> | null = null;
  const start = async (): Promise<RemoteConfig | null> => {
    const remoteConfig = await prepare(getApp, options);
    if (remoteConfig !== null) await fetchWithin(remoteConfig, options.timeoutMs);
    return remoteConfig;
  };
  return {
    load: async () => {
      try {
        ready ??= start();
        const remoteConfig = await ready;
        return remoteConfig === null ? DEFAULT_APP_CONFIG : readAppConfig(remoteConfig);
      } catch {
        logger.warn('Remote Config unavailable; using in-code defaults');
        return DEFAULT_APP_CONFIG;
      }
    },
  };
}
