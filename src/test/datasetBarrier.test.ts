import { describe, expect, it } from 'vitest';

/**
 * Information barrier of the fresh test split (DECISIONS 2026-11-17): only its loader, the
 * dataset harness test and the /eval route wiring may reference it, so no detector code or
 * tuning test can read it.
 * Scans source file contents for the file name; never opens the dataset itself.
 */
const NEEDLE = ['reports.v2', 'test.json'].join('.');
const ALLOWED = new Set([
  '/src/test/evalDatasetV2.ts',
  '/src/domain/evaluation/datasetV2.test.ts',
  // The /eval route wiring: preset 8 (final v2 test, run once by the owner).
  '/src/app/EvalRoute.tsx',
]);

const sources = import.meta.glob<string>('/src/**/*.{ts,tsx,js,jsx,mjs}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('fresh test split barrier', () => {
  it('scans the source tree', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('is referenced only by its loader, the dataset harness test and the eval route', () => {
    const offenders = Object.entries(sources)
      .filter(([path, text]) => text.includes(NEEDLE) && !ALLOWED.has(path))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('sees the loader reference (the scan matches real paths)', () => {
    expect(sources['/src/test/evalDatasetV2.ts']?.includes(NEEDLE)).toBe(true);
  });
});
