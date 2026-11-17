import { describe, expect, it } from 'vitest';
import { toRawText } from '../../domain/text/brandedText';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import { scanReport } from './scanReport';
import { fakeFinder, fakeVerifier } from './verifyCandidates.testKit';

const PARAGRAPHS = [
  'I restock the vending machines on the night rotation.',
  'The treasurer keeps the coins in a drawer.',
  'I sit by the loading bay every shift.',
];
const TEXT = toRawText(PARAGRAPHS.join('\n\n'));
const CHUNK_CHARS = 60;
const judge = () => ({ about: 'WRITER', category: 'SCHEDULE' }) as const;

function run(quotes: readonly string[]) {
  const progress: [number, number][] = [];
  const { verifier, calls } = fakeVerifier(judge);
  const clock = new FakeClock(1000, 25);
  const result = scanReport(
    TEXT,
    {
      scanner: new FakeIdentityScanner({ respond: () => ({ findings: [] }) }),
      clock,
      chunkChars: CHUNK_CHARS,
      disclosure: { finder: fakeFinder(quotes), verifier },
    },
    { onProgress: (done, total) => progress.push([done, total]) },
  );
  return { result, progress, calls };
}

describe('scan pipeline verify pass', () => {
  it('counts verifier calls in the progress total and finishes only after the last call', async () => {
    const { result, progress, calls } = run(['the night rotation', 'the loading bay']);
    expect((await result).ok).toBe(true);
    expect(calls).toHaveLength(2);
    const last = progress[progress.length - 1]!;
    expect(last).toEqual([6, 6]);
    // While chunks are scanned the total is an upper bound: never complete before the verifier.
    const scanPhase = progress.slice(0, 4);
    expect(scanPhase).toEqual([
      [0, 6],
      [1, 6],
      [2, 6],
      [3, 6],
    ]);
    expect(progress.filter(([done, total]) => done === total)).toEqual([last]);
  });

  it('never shrinks the displayed total nor moves progress backwards', async () => {
    const { result, progress } = run(['the night rotation']);
    await result;
    expect(progress).toEqual([
      [0, 6],
      [1, 6],
      [2, 6],
      [3, 6],
      [5, 6],
      [6, 6],
    ]);
    for (const [index, [done, total]] of progress.entries()) {
      const [prevDone, prevTotal] = progress[index - 1] ?? [0, 0];
      expect(done).toBeGreaterThanOrEqual(prevDone);
      expect(total).toBeGreaterThanOrEqual(prevTotal);
    }
  });

  it('reaches the end once the scan is done when no candidate needs a verifier call', async () => {
    const { result, progress } = run([]);
    await result;
    expect(progress[progress.length - 1]).toEqual([6, 6]);
    expect(progress.every(([, total]) => total === 6)).toBe(true);
  });

  it('records verifyMs (the verifier pass time) in the stats', async () => {
    const { result } = run(['the night rotation']);
    const value = await result;
    if (!value.ok) throw new Error(value.error.kind);
    expect(value.value.stats.verifyMs).toBe(25);
  });

  it('records verifyMs 0 without a verify pass', async () => {
    const value = await scanReport(
      TEXT,
      {
        scanner: new FakeIdentityScanner({ respond: () => ({ findings: [] }) }),
        clock: new FakeClock(1000, 25),
        chunkChars: CHUNK_CHARS,
      },
      {},
    );
    if (!value.ok) throw new Error(value.error.kind);
    expect(value.value.stats.verifyMs).toBe(0);
  });
});
