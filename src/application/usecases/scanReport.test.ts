import { describe, expect, it } from 'vitest';
import type { ModelFinding } from '../../domain/detection/types';
import { toRawText } from '../../domain/text/brandedText';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import {
  FakeIdentityScanner,
  type FakeScanStep,
} from '../../infrastructure/fakes/FakeIdentityScanner';
import { createAppError } from '../../shared/appError';
import { scanReport } from './scanReport';

const PARAGRAPHS = [
  'I am the only night nurse on ward 7.',
  'Write to me at jane.doe@example.com today.',
  'I sit at desk 14 near the exit.',
];
const TEXT = toRawText(PARAGRAPHS.join('\n\n'));
const CHUNK_CHARS = 50;

function mf(quote: string, category: ModelFinding['category']): ModelFinding {
  return { quote, category, reason: 'model reason', suggestion: null };
}

/** Answers by chunk content, like a real model would. */
function respond(chunk: string): FakeScanStep {
  if (chunk.includes('night nurse')) return { findings: [mf('only night nurse', 'ROLE_UNIQUE')] };
  if (chunk.includes('@')) return { findings: [mf('jane.doe@example.com', 'DIRECT_IDENTIFIER')] };
  return { findings: [mf('desk 14', 'LOCATION'), mf('in the basement', 'LOCATION')] };
}

function setup(
  options: ConstructorParameters<typeof FakeIdentityScanner>[0] = { respond },
  allowCloud?: boolean,
) {
  const scanner = new FakeIdentityScanner(options);
  const clock = new FakeClock(1000, 25);
  const progress: [number, number][] = [];
  const run = (text = TEXT, chunkChars = CHUNK_CHARS) =>
    scanReport(
      text,
      allowCloud === undefined
        ? { scanner, clock, chunkChars }
        : { scanner, clock, chunkChars, allowCloud },
      { onProgress: (done, total) => progress.push([done, total]) },
    );
  return { scanner, progress, run };
}

function spanOf(quote: string) {
  const start = TEXT.indexOf(quote);
  return { start, end: start + quote.length };
}

describe('scanReport', () => {
  it('merges rule and model findings with whole-report offsets across chunks', async () => {
    const { scanner, run } = setup();
    const result = await run();
    if (!result.ok) throw new Error(result.error.kind);
    expect(scanner.chunks).toEqual(PARAGRAPHS);
    expect(result.value.findings.map((f) => [f.quote, f.origin, f.span])).toEqual([
      ['only night nurse', 'MODEL', spanOf('only night nurse')],
      ['jane.doe@example.com', 'RULE', spanOf('jane.doe@example.com')],
      ['desk 14', 'MODEL', spanOf('desk 14')],
    ]);
    for (const f of result.value.findings)
      expect(TEXT.slice(f.span.start, f.span.end)).toBe(f.quote);
  });

  it('reports stats, duration and the on-device source', async () => {
    const { run } = setup();
    const result = await run();
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.source).toBe('ON_DEVICE');
    expect(result.value.stats).toEqual({
      chunks: 3,
      rawModelFindings: 4,
      locatedModelFindings: 3,
      unlocatedModelFindings: 1,
      retries: 0,
      durationMs: 25,
    });
  });

  it('counts unlocated quotes per raw finding, not per located span', async () => {
    const text = toRawText('desk 14 here. desk 14 again. desk 14 once more.');
    const scanner = new FakeIdentityScanner({
      steps: [
        {
          findings: [
            mf('desk 14', 'LOCATION'),
            mf('totally invented words', 'LOCATION'),
            mf('x', 'LOCATION'),
          ],
        },
      ],
    });
    const result = await scanReport(text, {
      scanner,
      clock: new FakeClock(0, 5),
      chunkChars: 3000,
    });
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.stats.rawModelFindings).toBe(3);
    expect(result.value.stats.locatedModelFindings).toBe(3);
    expect(result.value.stats.unlocatedModelFindings).toBe(2);
    expect(result.value.modelFindings).toHaveLength(3);
  });

  it('scans chunks strictly one after another and reports progress', async () => {
    const { scanner, progress, run } = setup();
    await run();
    expect(scanner.maxConcurrent).toBe(1);
    expect(scanner.events).toEqual(['start:0', 'end:0', 'start:1', 'end:1', 'start:2', 'end:2']);
    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('fails the whole scan when any chunk fails, without scanning further chunks', async () => {
    const error = createAppError('InvalidModelOutput', { message: 'bad output' });
    const { scanner, progress, run } = setup({ steps: [respond(PARAGRAPHS[0]!), { error }] });
    const result = await run();
    expect(result).toEqual({ ok: false, error });
    expect(scanner.chunks).toHaveLength(2);
    expect(progress).toEqual([
      [0, 3],
      [1, 3],
    ]);
  });

  it('with allowCloud, reports IN_CLOUD when any chunk ran in the cloud and sums retries', async () => {
    const { run } = setup(
      {
        steps: [
          { findings: [], retries: 1 },
          { findings: [], source: 'IN_CLOUD' },
          { findings: [], retries: 1 },
        ],
      },
      true,
    );
    const result = await run();
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.source).toBe('IN_CLOUD');
    expect(result.value.stats.retries).toBe(2);
  });

  it.each([undefined, false])(
    'stops after the first cloud chunk and discards all findings (allowCloud: %s)',
    async (allowCloud) => {
      const { scanner, progress, run } = setup(
        {
          steps: [
            respond(PARAGRAPHS[0]!),
            { findings: [mf('jane.doe@example.com', 'DIRECT_IDENTIFIER')], source: 'IN_CLOUD' },
          ],
          respond,
        },
        allowCloud,
      );
      const result = await run();
      if (result.ok) throw new Error('expected a PrivacyViolation');
      expect(result.error.kind).toBe('PrivacyViolation');
      expect(Object.keys(result.error).sort()).toEqual(['kind', 'message']);
      for (const paragraph of PARAGRAPHS) expect(result.error.message).not.toContain(paragraph);
      expect(result.error.message).not.toContain('jane.doe');
      // The third chunk is never sent, and the cloud chunk never counts as done.
      expect(scanner.chunks).toHaveLength(2);
      expect(progress).toEqual([
        [0, 3],
        [1, 3],
      ]);
    },
  );

  it('still returns rule findings when the model finds nothing', async () => {
    const { run } = setup({});
    const result = await run();
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.findings.map((f) => f.origin)).toEqual(['RULE']);
  });

  it('handles an empty report without calling the model', async () => {
    const { scanner, progress, run } = setup();
    const result = await run(toRawText('  \n '));
    expect(result).toEqual({
      ok: true,
      value: {
        findings: [],
        modelFindings: [],
        source: 'ON_DEVICE',
        stats: {
          chunks: 0,
          rawModelFindings: 0,
          locatedModelFindings: 0,
          unlocatedModelFindings: 0,
          retries: 0,
          durationMs: 25,
        },
      },
    });
    expect(scanner.chunks).toEqual([]);
    expect(progress).toEqual([[0, 0]]);
  });

  it('sends the model chunks of at most chunkChars characters', async () => {
    const { scanner, run } = setup();
    const long = toRawText(
      Array.from({ length: 200 }, () => 'I saw it happen again.').join('\n\n'),
    );
    const result = await run(long, 3000);
    expect(result.ok).toBe(true);
    expect(scanner.chunks.length).toBeGreaterThan(1);
    for (const chunk of scanner.chunks) expect(chunk.length).toBeLessThanOrEqual(3000);
  });
});
