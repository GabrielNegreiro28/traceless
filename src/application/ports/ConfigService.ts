/**
 * Remotely tunable settings (PLANO §3.5, Remote Config). Minimal on purpose: Fase 5a adds the
 * other parameters. Values always have an in-code default, so the app works without a fetch.
 */
export interface AppConfig {
  /**
   * Kill switch for the consented cloud scan (`cloud_scan_enabled`). When false the cloud
   * option is hidden and the scan refuses to run.
   */
  readonly cloudScanEnabled: boolean;
}

/** In-code defaults; the Remote Config template must agree (tested in the adapter). */
export const DEFAULT_APP_CONFIG: AppConfig = { cloudScanEnabled: true };

export interface ConfigService {
  /**
   * The current settings. Never rejects: a slow, failed or unsupported fetch resolves to the
   * last good values or to DEFAULT_APP_CONFIG.
   */
  load(): Promise<AppConfig>;
}
