import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import templateSource from '../../../firebase/remoteconfig.template.json?raw';
import {
  JSON_REMOTE_CONFIG_KEYS,
  REMOTE_CONFIG_DEFAULTS,
  REPORT_CATEGORIES,
  type RemoteConfigKey,
} from './remoteConfigDefaults';

const TEMPLATE_SCHEMA = z.object({
  conditions: z.array(z.unknown()),
  parameters: z.record(
    z.string(),
    z.object({
      defaultValue: z.object({ value: z.string() }),
      valueType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON']),
      description: z.string().min(1),
    }),
  ),
});

const template = TEMPLATE_SCHEMA.parse(JSON.parse(templateSource));
const defaults: Readonly<Record<string, string | number | boolean>> = REMOTE_CONFIG_DEFAULTS;

function expectedValueType(key: string, value: string | number | boolean): string {
  if ((JSON_REMOTE_CONFIG_KEYS as readonly string[]).includes(key)) return 'JSON';
  if (typeof value === 'number') return 'NUMBER';
  if (typeof value === 'boolean') return 'BOOLEAN';
  return 'STRING';
}

describe('Remote Config template vs in-code defaults', () => {
  it('declares exactly the same parameters', () => {
    expect(Object.keys(template.parameters).sort()).toEqual(Object.keys(defaults).sort());
  });

  it.each(Object.entries(defaults))('%s has the same value and type', (key, value) => {
    const parameter = template.parameters[key];

    expect(parameter?.defaultValue.value).toBe(String(value));
    expect(parameter?.valueType).toBe(expectedValueType(key, value));
  });

  it('has valid JSON for JSON parameters', () => {
    const key: RemoteConfigKey = 'report_categories';
    const raw = template.parameters[key]?.defaultValue.value ?? '';

    expect(z.array(z.string()).parse(JSON.parse(raw))).toEqual(REPORT_CATEGORIES);
  });
});
