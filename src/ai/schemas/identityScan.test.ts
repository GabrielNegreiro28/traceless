import { describe, expect, it } from 'vitest';
import { FINDING_CATEGORIES } from '../../domain/detection/types';
import {
  MAX_MODEL_FINDINGS,
  MAX_PROTECTED_QUOTES,
  MAX_REASON_CHARS,
  MODEL_FINDING_CATEGORIES,
  OUTLET_LABELS,
  buildIdentityScanSchema,
  modelCategorySchema,
  parseIdentityScanOutput,
  scanLabelSchema,
} from './identityScan';

const ALL = MODEL_FINDING_CATEGORIES;

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    quote: 'the only night nurse',
    category: 'ROLE_UNIQUE',
    reason: 'Only one person has this role.',
    suggestion: 'a nurse',
    ...overrides,
  };
}

function parse(value: unknown, allowed = ALL) {
  return parseIdentityScanOutput(JSON.stringify(value), allowed);
}

function output(result: ReturnType<typeof parse>) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.kind}`);
  return result.value;
}

function values(result: ReturnType<typeof parse>) {
  return output(result).findings;
}

describe('MODEL_FINDING_CATEGORIES', () => {
  it('is FINDING_CATEGORIES minus WRITING_STYLE, in order', () => {
    expect(MODEL_FINDING_CATEGORIES).toEqual(
      FINDING_CATEGORIES.filter((c) => c !== 'WRITING_STYLE'),
    );
    expect(MODEL_FINDING_CATEGORIES).toHaveLength(7);
  });

  it('has parity between the JSON Schema enum and the zod enum', () => {
    const schema = buildIdentityScanSchema(ALL);
    const categoryEnum = schema.properties?.findings?.items?.properties?.category?.enum;
    expect(categoryEnum).toEqual([...ALL]);
    expect(modelCategorySchema.options).toEqual([...ALL]);
  });

  it('has parity between the JSON Schema enum and the zod enum with outlets', () => {
    const schema = buildIdentityScanSchema(ALL, OUTLET_LABELS);
    const labelEnum = schema.properties?.findings?.items?.properties?.category?.enum;
    expect(labelEnum).toEqual([...ALL, 'REPORTED_PERSON', 'OTHER_PERSON']);
    expect(scanLabelSchema.options).toEqual(labelEnum);
  });
});

describe('buildIdentityScanSchema', () => {
  it('matches the design-doc shape', () => {
    expect(buildIdentityScanSchema(['SCHEDULE', 'LOCATION'])).toEqual({
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              quote: { type: 'string' },
              category: { type: 'string', enum: ['SCHEDULE', 'LOCATION'] },
              reason: { type: 'string' },
              suggestion: { type: 'string' },
            },
            required: ['quote', 'category', 'reason', 'suggestion'],
          },
        },
      },
      required: ['findings'],
    });
  });

  it('adds outlets after the categories and room for protected quotes', () => {
    const schema = buildIdentityScanSchema(['SCHEDULE'], OUTLET_LABELS);
    const findings = schema.properties?.findings;
    expect(findings?.maxItems).toBe(MAX_MODEL_FINDINGS + MAX_PROTECTED_QUOTES);
    expect(findings?.items?.properties?.category?.enum).toEqual([
      'SCHEDULE',
      'REPORTED_PERSON',
      'OTHER_PERSON',
    ]);
    expect(buildIdentityScanSchema(['SCHEDULE'], [])).toEqual(
      buildIdentityScanSchema(['SCHEDULE']),
    );
  });

  it('returns a fresh object on every call', () => {
    const a = buildIdentityScanSchema(ALL);
    const b = buildIdentityScanSchema(ALL);
    expect(a).not.toBe(b);
    expect(a.properties?.findings?.items?.properties?.category?.enum).not.toBe(ALL);
  });
});

describe('parseIdentityScanOutput', () => {
  it('parses valid output and maps an empty suggestion to null', () => {
    const result = output(
      parse({ findings: [item(), item({ quote: 'my desk', suggestion: '' })] }),
    );
    expect(result.protectedQuotes).toEqual([]);
    expect(result.findings).toEqual([
      {
        quote: 'the only night nurse',
        category: 'ROLE_UNIQUE',
        reason: 'Only one person has this role.',
        suggestion: 'a nurse',
      },
      {
        quote: 'my desk',
        category: 'ROLE_UNIQUE',
        reason: 'Only one person has this role.',
        suggestion: null,
      },
    ]);
  });

  it('accepts an empty findings list', () => {
    expect(output(parse({ findings: [] }))).toEqual({ findings: [], protectedQuotes: [] });
  });

  it('drops invalid items and keeps the valid ones', () => {
    const findings = [
      item({ category: 'WRITING_STYLE' }),
      item({ category: 'NOT_A_CATEGORY' }),
      item({ quote: 42 }),
      { quote: 'missing fields' },
      'not an object',
      item({ quote: '   ' }),
      item({ quote: 'kept' }),
    ];
    expect(values(parse({ findings })).map((f) => f.quote)).toEqual(['kept']);
  });

  it('drops categories outside the allowed group', () => {
    const findings = [item({ category: 'ROLE_UNIQUE' }), item({ category: 'SCHEDULE' })];
    expect(values(parse({ findings }, ['SCHEDULE'])).map((f) => f.category)).toEqual(['SCHEDULE']);
  });

  it('keeps at most 12 valid items', () => {
    const findings = Array.from({ length: 15 }, (_, i) => item({ quote: `quote ${i}` }));
    const result = values(parse({ findings }));
    expect(result).toHaveLength(MAX_MODEL_FINDINGS);
    expect(result.at(-1)?.quote).toBe('quote 11');
  });

  it('clamps the reason to 200 characters', () => {
    const result = values(parse({ findings: [item({ reason: 'x'.repeat(500) })] }));
    expect(result[0]?.reason).toHaveLength(MAX_REASON_CHARS);
  });

  it('drops quotes longer than 120 characters', () => {
    const findings = [item({ quote: 'q'.repeat(121) }), item({ quote: 'q'.repeat(120) })];
    expect(values(parse({ findings })).map((f) => f.quote.length)).toEqual([120]);
  });

  it('tolerates JSON wrapped in a ```json fence', () => {
    const text = '```json\n' + JSON.stringify({ findings: [item()] }) + '\n```';
    expect(values(parseIdentityScanOutput(text, ALL))).toHaveLength(1);
  });

  it('returns InvalidModelOutput for non-JSON text, without echoing it', () => {
    const result = parseIdentityScanOutput('I found my secret desk number', ALL);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('InvalidModelOutput');
    expect(result.error.message).not.toContain('secret');
  });

  it.each([[null], [[]], [{}], [{ findings: 'none' }], [{ results: [] }]])(
    'returns InvalidModelOutput for a bad top-level shape: %j',
    (value) => {
      const result = parse(value);
      expect(result.ok ? 'ok' : result.error.kind).toBe('InvalidModelOutput');
    },
  );
});
