/**
 * In-code Remote Config defaults (PLANO §3.5), so the app works before or
 * without a fetch. Must match firebase/remoteconfig.template.json; a test
 * fails on any drift.
 */
export const REPORT_CATEGORIES: readonly string[] = [
  'Fraud or financial misconduct',
  'Health and safety',
  'Harassment or discrimination',
  'Environmental harm',
  'Privacy or data protection',
  'Other',
];

export const REMOTE_CONFIG_DEFAULTS = {
  report_categories: JSON.stringify(REPORT_CATEGORIES),
  ack_deadline_days: 7,
  feedback_deadline_days: 90,
  cloud_model_name: 'gemini-3.5-flash-lite',
  rights_advice_enabled: true,
  identity_prompt_version: 'v1',
} as const satisfies Readonly<Record<string, string | number | boolean>>;

export type RemoteConfigKey = keyof typeof REMOTE_CONFIG_DEFAULTS;

/** Parameters whose STRING value holds JSON (valueType "JSON" in the template). */
export const JSON_REMOTE_CONFIG_KEYS: readonly RemoteConfigKey[] = ['report_categories'];
