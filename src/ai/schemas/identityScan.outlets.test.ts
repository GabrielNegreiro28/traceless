import { describe, expect, it } from 'vitest';
import {
  MAX_MODEL_FINDINGS,
  MAX_PROTECTED_QUOTES,
  MODEL_FINDING_CATEGORIES,
  OUTLET_LABELS,
  parseIdentityScanOutput,
  type OutletLabel,
} from './identityScan';

const ALL = MODEL_FINDING_CATEGORIES;

function item(quote: string, category: string): Record<string, unknown> {
  return { quote, category, reason: 'r', suggestion: '' };
}

function parse(items: unknown[], outlets: readonly OutletLabel[] = OUTLET_LABELS) {
  const result = parseIdentityScanOutput(JSON.stringify({ findings: items }), ALL, outlets);
  if (!result.ok) throw new Error(`expected ok, got ${result.error.kind}`);
  return result.value;
}

describe('parseIdentityScanOutput with outlets', () => {
  it('separates outlet items into protected quotes, never findings', () => {
    const result = parse([
      item('the head brewer, Tomasz', 'REPORTED_PERSON'),
      item('the only forklift driver', 'ROLE_UNIQUE'),
      item('a delivery driver', 'OTHER_PERSON'),
    ]);
    expect(result.findings.map((f) => [f.quote, f.category])).toEqual([
      ['the only forklift driver', 'ROLE_UNIQUE'],
    ]);
    expect(result.protectedQuotes).toEqual(['the head brewer, Tomasz', 'a delivery driver']);
  });

  it('drops outlet items entirely when no outlets are enabled (v1 behaviour)', () => {
    const result = parse(
      [item('the head brewer, Tomasz', 'REPORTED_PERSON'), item('my locker', 'LOCATION')],
      [],
    );
    expect(result.protectedQuotes).toEqual([]);
    expect(result.findings.map((f) => f.quote)).toEqual(['my locker']);
  });

  it('keeps only the enabled outlets', () => {
    const result = parse(
      [item('Tomasz', 'REPORTED_PERSON'), item('a courier', 'OTHER_PERSON')],
      ['REPORTED_PERSON'],
    );
    expect(result.protectedQuotes).toEqual(['Tomasz']);
  });

  it('trims protected quotes and drops empty or oversized ones', () => {
    const result = parse([
      item('  Tomasz  ', 'REPORTED_PERSON'),
      item('   ', 'REPORTED_PERSON'),
      item('q'.repeat(121), 'OTHER_PERSON'),
      { quote: 'missing fields', category: 'OTHER_PERSON' },
    ]);
    expect(result.protectedQuotes).toEqual(['Tomasz']);
  });

  it('caps findings and protected quotes independently', () => {
    const outletItems = Array.from({ length: 10 }, (_, i) => item(`person ${i}`, 'OTHER_PERSON'));
    const findingItems = Array.from({ length: 14 }, (_, i) => item(`detail ${i}`, 'SCHEDULE'));
    const result = parse([...outletItems, ...findingItems]);
    expect(result.protectedQuotes).toHaveLength(MAX_PROTECTED_QUOTES);
    expect(result.findings).toHaveLength(MAX_MODEL_FINDINGS);
    expect(result.findings[0]?.quote).toBe('detail 0');
  });

  it('still rejects a bad top-level shape', () => {
    const result = parseIdentityScanOutput('{"people":[]}', ALL, OUTLET_LABELS);
    expect(!result.ok && result.error.kind).toBe('InvalidModelOutput');
  });
});
