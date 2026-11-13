/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDataset } from '../../domain/evaluation/datasetSchema';
import { DEMO_ORG_NAME, MAX_REPORT_CHARS } from './reportLimits';
import { SAMPLE_REPORT } from './sampleReport';

const SEQUENCE = 6;

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

function sequences(text: string): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + SEQUENCE <= w.length; i++) out.add(w.slice(i, i + SEQUENCE).join(' '));
  return out;
}

function datasetTexts(): string[] {
  const raw = readFileSync(resolve(process.cwd(), 'eval/datasets/reports.v1.json'), 'utf8');
  const parsed = parseDataset(JSON.parse(raw));
  if (!parsed.ok) throw new Error('dataset did not parse');
  return parsed.value.reports.map((r) => r.text);
}

describe('SAMPLE_REPORT', () => {
  it('is 120 to 180 words and fits the composer cap', () => {
    const count = words(SAMPLE_REPORT).length;
    expect(count).toBeGreaterThanOrEqual(120);
    expect(count).toBeLessThanOrEqual(180);
    expect(SAMPLE_REPORT.length).toBeLessThan(MAX_REPORT_CHARS);
  });

  it('is first person and names the accused with a title', () => {
    expect(SAMPLE_REPORT).toMatch(/\bI am\b/);
    expect(SAMPLE_REPORT).toMatch(/Gary Pemberton, the operations manager/);
  });

  it('mentions the fictional demo organization', () => {
    expect(SAMPLE_REPORT).toContain(DEMO_ORG_NAME);
  });

  it('shares no 6-word sequence with any evaluation report', () => {
    const own = sequences(SAMPLE_REPORT);
    const shared: number[] = [];
    for (const [index, text] of datasetTexts().entries()) {
      for (const seq of sequences(text)) if (own.has(seq)) shared.push(index);
    }
    // Report only report indices, never the matching text.
    expect(shared).toEqual([]);
  });

  it('the invented org and town names do not appear in the evaluation dataset', () => {
    const joined = datasetTexts().join('\n').toLowerCase();
    expect(joined).not.toContain('northwind');
    expect(joined).not.toContain('halvern');
    expect(joined).not.toContain('brackenford');
  });
});
