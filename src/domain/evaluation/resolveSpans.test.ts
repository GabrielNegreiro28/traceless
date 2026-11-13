import { describe, expect, it } from 'vitest';
import { parseDataset, type Dataset, type DatasetReport } from './datasetSchema';
import { resolveQuote, resolveReport, validateDataset } from './resolveSpans';

const TEXT = 'I work nights. I work nights again. Bob did it.';

function report(overrides: Partial<DatasetReport> = {}): DatasetReport {
  return {
    id: 'r1',
    sector: 'health',
    split: 'dev',
    text: TEXT,
    gold: [{ quote: 'Bob', category: 'DIRECT_IDENTIFIER' }],
    mustNotFlag: [],
    ...overrides,
  };
}

const dataset = (...reports: DatasetReport[]): Dataset => ({ version: 'v1', reports });

describe('resolveQuote', () => {
  it('resolves a unique quote to its exact span', () => {
    expect(resolveQuote(TEXT, 'Bob did it')).toEqual({
      ok: true,
      value: { start: 36, end: 46 },
    });
  });

  it('rejects missing, empty and ambiguous quotes', () => {
    expect(resolveQuote(TEXT, 'Alice')).toEqual({ ok: false, error: 'QUOTE_NOT_FOUND' });
    expect(resolveQuote(TEXT, '')).toEqual({ ok: false, error: 'EMPTY_QUOTE' });
    expect(resolveQuote(TEXT, 'I work nights')).toEqual({ ok: false, error: 'QUOTE_AMBIGUOUS' });
  });

  it('picks the Nth occurrence (1-based) and rejects out-of-range', () => {
    expect(resolveQuote(TEXT, 'I work nights', 2)).toEqual({
      ok: true,
      value: { start: 15, end: 28 },
    });
    expect(resolveQuote(TEXT, 'I work nights', 3)).toEqual({
      ok: false,
      error: 'OCCURRENCE_OUT_OF_RANGE',
    });
  });

  it('is case-sensitive and exact', () => {
    expect(resolveQuote(TEXT, 'bob').ok).toBe(false);
  });
});

describe('validateDataset', () => {
  it('accepts a consistent dataset', () => {
    expect(validateDataset(dataset(report()))).toEqual([]);
  });

  it('reports unresolved quotes with annotation paths, not text', () => {
    const problems = validateDataset(
      dataset(
        report({
          gold: [{ quote: 'Zed', category: 'LOCATION' }],
          mustNotFlag: [{ quote: 'I work nights', kind: 'OTHER_PERSON' }],
        }),
      ),
    );
    expect(problems).toEqual([
      { reportId: 'r1', code: 'QUOTE_NOT_FOUND', path: 'gold[0]' },
      { reportId: 'r1', code: 'QUOTE_AMBIGUOUS', path: 'mustNotFlag[0]' },
    ]);
  });

  it('reports gold spans overlapping a must-not span', () => {
    const problems = validateDataset(
      dataset(
        report({
          gold: [{ quote: 'Bob did', category: 'DIRECT_IDENTIFIER' }],
          mustNotFlag: [{ quote: 'did it', kind: 'ACCUSED' }],
        }),
      ),
    );
    expect(problems.map((p) => p.code)).toEqual(['GOLD_OVERLAPS_MUST_NOT']);
  });

  it('reports duplicate ids', () => {
    const problems = validateDataset(dataset(report(), report()));
    expect(problems).toEqual([{ reportId: 'r1', code: 'DUPLICATE_ID', path: 'id' }]);
  });
});

describe('resolveReport', () => {
  it('returns resolved spans for valid annotations', () => {
    const resolved = resolveReport(
      report({ mustNotFlag: [{ quote: 'I work nights', kind: 'INCIDENT_FACT', occurrence: 1 }] }),
    );
    expect(resolved.ok && resolved.value.mustNot[0]?.span).toEqual({ start: 0, end: 13 });
  });
});

describe('parseDataset', () => {
  it('parses a valid dataset', () => {
    expect(parseDataset(dataset(report())).ok).toBe(true);
  });

  it('rejects bad shapes with paths only', () => {
    const bad = { version: 'v1', reports: [{ ...report(), split: 'train', secret: 1 }] };
    const parsed = parseDataset(bad);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.kind === 'Misconfigured') {
      expect(parsed.error.missing).toContain('reports.0.split');
      expect(JSON.stringify(parsed.error)).not.toContain(TEXT);
    }
  });

  it('rejects an invalid category and a non-positive occurrence', () => {
    const base = report();
    expect(
      parseDataset({
        ...dataset(base),
        reports: [{ ...base, gold: [{ quote: 'a', category: 'X' }] }],
      }).ok,
    ).toBe(false);
    expect(
      parseDataset(
        dataset(report({ gold: [{ quote: 'Bob', category: 'LOCATION', occurrence: 0 }] })),
      ).ok,
    ).toBe(false);
  });
});
