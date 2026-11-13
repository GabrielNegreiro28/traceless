import { describe, expect, it } from 'vitest';
import { parseDataset } from './datasetSchema';
import { validateDataset } from './resolveSpans';

// Read as raw text at build time: the project has no Node type definitions for `fs`.
const files = import.meta.glob<string>('../../../eval/datasets/reports.v1.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function loadDataset(): unknown {
  const text = Object.values(files)[0];
  if (text === undefined) throw new Error('eval/datasets/reports.v1.json not found');
  return JSON.parse(text);
}

describe('eval/datasets/reports.v1.json', () => {
  it('matches the dataset schema', () => {
    expect(parseDataset(loadDataset()).ok).toBe(true);
  });

  it('has every quote resolved once and no gold overlapping a must-not span', () => {
    const parsed = parseDataset(loadDataset());
    if (!parsed.ok) throw new Error('dataset does not parse');
    expect(validateDataset(parsed.value)).toEqual([]);
  });
});
