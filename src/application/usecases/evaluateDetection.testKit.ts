import type { ModelFinding } from '../../domain/detection/types';
import type { Dataset } from '../../domain/evaluation/datasetSchema';
import { evaluateDetection, type EvalProgress, type EvalScan } from './evaluateDetection';

/**
 * Synthetic fixtures shared by the evaluateDetection tests. Test-only and adapter-free
 * (application code may not import fakes); never imported by the app.
 */
export const DATASET: Dataset = {
  version: 'test-v1',
  reports: [
    {
      id: 'a',
      sector: 'health',
      split: 'dev',
      text: 'I am the only night nurse. Mail me at jane@example.com. Dr Smith took the drugs.',
      gold: [
        { quote: 'only night nurse', category: 'ROLE_UNIQUE' },
        { quote: 'jane@example.com', category: 'DIRECT_IDENTIFIER' },
      ],
      mustNotFlag: [{ quote: 'Dr Smith', kind: 'ACCUSED' }],
    },
    {
      id: 'b',
      sector: 'finance',
      split: 'test',
      text: 'I sit at desk 14. Contact bob@corp.com please. The invoice was for big money.',
      gold: [
        { quote: 'desk 14', category: 'LOCATION' },
        { quote: 'bob@corp.com', category: 'DIRECT_IDENTIFIER' },
      ],
      mustNotFlag: [{ quote: 'big money', kind: 'INCIDENT_FACT' }],
    },
    {
      id: 'c',
      sector: 'retail',
      split: 'test',
      text: 'Nothing here points to me at all.',
      gold: [],
      mustNotFlag: [{ quote: 'Nothing here', kind: 'INCIDENT_FACT' }],
    },
  ],
};

export const VARIANT = {
  id: 'v',
  promptVersion: 'p',
  strategy: 'single',
  chunkChars: 3000,
  postFilters: [],
} as const;

export const mf = (quote: string, category: ModelFinding['category']): ModelFinding => ({
  quote,
  category,
  reason: 'r',
  suggestion: null,
});

/** What a model would answer for each DATASET report (one hallucinated quote included). */
export function respond(chunk: string): { readonly findings: ModelFinding[] } {
  if (chunk.includes('night nurse')) {
    return {
      findings: [mf('only night nurse', 'ROLE_UNIQUE'), mf('Dr Smith', 'DIRECT_IDENTIFIER')],
    };
  }
  if (chunk.includes('desk 14')) {
    return { findings: [mf('desk 14', 'LOCATION'), mf('ghost', 'LOCATION')] };
  }
  return { findings: [] };
}

/** Evaluates DATASET (or `dataset`) with clock 1000 and the test variant; throws on error. */
export async function runEval(
  scan: EvalScan,
  split: 'dev' | 'test' | 'all',
  runs = 1,
  progress?: EvalProgress[],
  dataset: Dataset = DATASET,
) {
  const result = await evaluateDetection({
    dataset,
    split,
    scan,
    clock: { now: () => 1000 },
    runs,
    variant: { ...VARIANT, id: 'v-test', promptVersion: 'p-test' },
    ...(progress ? { onProgress: (p: EvalProgress) => progress.push(p) } : {}),
  });
  if (!result.ok) throw new Error('evaluation failed');
  return result.value;
}
