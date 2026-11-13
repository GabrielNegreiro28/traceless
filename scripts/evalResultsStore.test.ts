import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_BODY_BYTES,
  parseResultMeta,
  resultFileName,
  saveEvalResult,
} from './evalResultsStore.ts';

const META = { promptVersion: 'identityScan.v1', strategy: 'single', split: 'test' };
const NOW = new Date('2026-11-13T03:51:34.123Z');
const body = (extra: object = {}) => JSON.stringify({ ...META, ...extra });

describe('parseResultMeta', () => {
  it('accepts an object with safe labels', () => {
    expect(parseResultMeta(body())).toEqual(META);
  });

  it.each([
    ['not JSON', '{nope'],
    ['an array', '[]'],
    ['null', 'null'],
    ['a missing field', JSON.stringify({ strategy: 'single', split: 'dev' })],
    ['a path in a label', body({ strategy: '../evil' })],
    ['a slash in a label', body({ split: 'a/b' })],
    ['a non-string label', body({ promptVersion: 3 })],
  ])('rejects %s', (_name, text) => {
    expect(parseResultMeta(text)).toBeNull();
  });
});

describe('variant ids', () => {
  it('names the file after the variant id', () => {
    const text = body({ variant: { id: 'v2-single2' } });
    const meta = parseResultMeta(text);
    expect(meta).toEqual({ ...META, variantId: 'v2-single2' });
    expect(resultFileName(meta ?? META, NOW)).toBe('v2-single2-test-2026-11-13T03-51-34.123Z.json');
  });

  it.each([{ id: '../x' }, { id: 3 }, null, {}])('rejects an unsafe variant %j', (variant) => {
    expect(parseResultMeta(body({ variant }))).toBeNull();
  });
});

describe('resultFileName', () => {
  it('has no colons and is built from labels plus the timestamp', () => {
    expect(resultFileName(META, NOW)).toBe(
      'identityScan.v1-single-test-2026-11-13T03-51-34.123Z.json',
    );
  });
});

describe('saveEvalResult', () => {
  it('writes the file and answers with its server-chosen name', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'traceless-eval-test-'));
    const outcome = await saveEvalResult(body({ extra: 1 }), dir, NOW);
    expect(outcome.status).toBe(201);
    const file = outcome.body.file ?? '';
    expect(file).toBe(resultFileName(META, NOW));
    expect(JSON.parse(await readFile(join(dir, file), 'utf8'))).toMatchObject({ extra: 1 });
  });

  it('never overwrites an existing file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'traceless-eval-test-'));
    expect((await saveEvalResult(body(), dir, NOW)).status).toBe(201);
    const second = await saveEvalResult(body({ extra: 2 }), dir, NOW);
    expect(second.status).toBe(409);
    const kept = await readFile(join(dir, resultFileName(META, NOW)), 'utf8');
    expect(kept).not.toContain('extra');
  });

  it('rejects oversized and invalid bodies without writing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'traceless-eval-test-'));
    const big = body({ pad: 'x'.repeat(MAX_BODY_BYTES) });
    expect((await saveEvalResult(big, dir, NOW)).status).toBe(413);
    expect((await saveEvalResult('[]', dir, NOW)).status).toBe(400);
  });
});
