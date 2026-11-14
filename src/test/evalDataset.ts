import { parseDataset, type Dataset } from '../domain/evaluation/datasetSchema';

/**
 * The real evaluation dataset for tests. Test-only. Tests must never print its text or
 * quotes: report counts, rates and invented strings only. Tests that measure detection on
 * it use the dev split only (docs/design/fase2-gate-iteration.md §G.3).
 */

// Read as raw text at build time: the app tsconfig has no Node types for `fs`.
const files = import.meta.glob<string>('../../eval/datasets/reports.v1.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});

export function loadEvalDataset(): Dataset {
  const text = Object.values(files)[0];
  if (text === undefined) throw new Error('eval/datasets/reports.v1.json not found');
  const parsed = parseDataset(JSON.parse(text));
  if (!parsed.ok) throw new Error('eval/datasets/reports.v1.json does not parse');
  return parsed.value;
}
