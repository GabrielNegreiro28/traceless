import { parseDataset, type Dataset } from '../domain/evaluation/datasetSchema';

/**
 * The fresh held-out test split (reports.v2-test), authored blind to the detector. Test-only.
 * Tests must never print its text or quotes: report counts, ids and annotation paths only.
 */

// Read as raw text at build time: the app tsconfig has no Node types for `fs`.
const files = import.meta.glob<string>('../../eval/datasets/reports.v2.test.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** Parsed JSON before schema validation, so tests can assert on the parse step itself. */
export function loadEvalDatasetV2Json(): unknown {
  const text = Object.values(files)[0];
  if (text === undefined) throw new Error('eval/datasets/reports.v2.test.json not found');
  return JSON.parse(text);
}

export function loadEvalDatasetV2(): Dataset {
  const parsed = parseDataset(loadEvalDatasetV2Json());
  if (!parsed.ok) throw new Error('eval/datasets/reports.v2.test.json does not parse');
  return parsed.value;
}
