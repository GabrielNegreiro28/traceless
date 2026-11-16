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
  /** Days the organization has to acknowledge receipt (`ack_deadline_days`). */
  readonly ackDeadlineDays: number;
  /** Days the organization has to give feedback (`feedback_deadline_days`). */
  readonly feedbackDeadlineDays: number;
}

/** In-code defaults; the Remote Config template must agree (tested in the adapter). */
export const DEFAULT_APP_CONFIG: AppConfig = {
  cloudScanEnabled: true,
  ackDeadlineDays: 7,
  feedbackDeadlineDays: 90,
};

export interface ConfigService {
  /**
   * The current settings. Never rejects: a slow, failed or unsupported fetch resolves to the
   * last good values or to DEFAULT_APP_CONFIG.
   */
  load(): Promise<AppConfig>;
}
