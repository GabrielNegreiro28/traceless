import type { FirebaseApp } from 'firebase/app';
import { getRemoteConfig, type RemoteConfig } from 'firebase/remote-config';
import { REMOTE_CONFIG_DEFAULTS } from './remoteConfigDefaults';

/**
 * Returns the Remote Config instance with in-code defaults applied (idempotent).
 * Fetching and activating come later (ConfigService, Fase 5).
 */
export function getRemoteConfigService(app: FirebaseApp): RemoteConfig {
  const remoteConfig = getRemoteConfig(app);
  remoteConfig.defaultConfig = { ...REMOTE_CONFIG_DEFAULTS };
  return remoteConfig;
}
