import { describe, expect, it } from 'vitest';
import { chunkText } from '../../domain/detection/textChunker';
import { toRawText } from '../../domain/text/brandedText';
import { createAppError } from '../../shared/appError';
import { fakeFinder, fakeVerifier } from './verifyCandidates.testKit';
import { candidatesInChunk, MAX_CANDIDATES_PER_CALL, runVerifyPass } from './verifyCandidatesPass';

const FIRST = 'I restock the vending machines on the night rotation.';
const SECOND = 'The treasurer pockets the coins. I sit by the loading bay.';
const TEXT = toRawText(`${FIRST}\n\n${SECOND}`);
const CHUNKS = chunkText(TEXT, Math.max(FIRST.length, SECOND.length) + 2);
const QUOTES = [
  'the night rotation',
  'pockets the coins',
  'the loading bay',
  'restock the vending',
];

const judge = (quote: string) =>
  quote === 'pockets the coins'
    ? ({ about: 'OTHER', category: 'NONE' } as const)
    : quote === 'restock the vending'
      ? ({ about: 'WRITER', category: 'NONE' } as const)
      : ({ about: 'WRITER', category: quote.includes('night') ? 'SCHEDULE' : 'LOCATION' } as const);

const never = () => false;

describe('runVerifyPass', () => {
  it('sends each chunk only its own candidates and keeps WRITER verdicts with a category', async () => {
    expect(CHUNKS).toHaveLength(2);
    const { verifier, calls } = fakeVerifier(judge);
    const result = await runVerifyPass(
      TEXT,
      CHUNKS,
      { finder: fakeFinder(QUOTES), verifier },
      never,
    );
    expect(calls).toEqual([
      { chunk: FIRST, candidates: ['restock the vending', 'the night rotation'] },
      { chunk: SECOND, candidates: ['pockets the coins', 'the loading bay'] },
    ]);
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.findings.map((f) => [f.quote, f.category, f.origin])).toEqual([
      ['the night rotation', 'SCHEDULE', 'MODEL'],
      ['the loading bay', 'LOCATION', 'MODEL'],
    ]);
    for (const finding of result.value.findings) {
      expect(TEXT.slice(finding.span.start, finding.span.end)).toBe(finding.quote);
    }
  });

  it('skips chunks without candidates and drops candidates straddling two chunks', () => {
    const straddle = { span: { start: FIRST.length - 5, end: FIRST.length + 6 }, quote: 'x' };
    const inside = { span: { start: 0, end: 9 }, quote: 'I restock' };
    expect(candidatesInChunk([straddle, inside], CHUNKS[0]!)).toEqual([inside]);
    expect(candidatesInChunk([straddle], CHUNKS[1]!)).toEqual([]);
  });

  it('caps the candidates of one call', () => {
    const many = Array.from({ length: MAX_CANDIDATES_PER_CALL + 5 }, (_, i) => ({
      span: { start: i, end: i + 1 },
      quote: 'q',
    }));
    expect(candidatesInChunk(many, CHUNKS[0]!)).toHaveLength(MAX_CANDIDATES_PER_CALL);
  });

  it('adds nothing (and calls no model) when the candidate finder fails', async () => {
    const { verifier, calls } = fakeVerifier(judge);
    const deps = { finder: fakeFinder(QUOTES, true), verifier };
    expect(await runVerifyPass(TEXT, CHUNKS, deps, never)).toEqual({
      ok: true,
      value: { findings: [], retries: 0 },
    });
    expect(calls).toEqual([]);
  });

  it('fails closed on an off-device verification, discarding everything', async () => {
    const { verifier } = fakeVerifier(judge, { source: 'IN_CLOUD' });
    const result = await runVerifyPass(
      TEXT,
      CHUNKS,
      { finder: fakeFinder(QUOTES), verifier },
      never,
    );
    expect(!result.ok && result.error.kind).toBe('PrivacyViolation');
  });

  it('propagates a verifier failure and stops on cancellation', async () => {
    const stuck = createAppError('OnDeviceStuck', { message: 'stalled', recoverable: false });
    const failing = fakeVerifier(judge, stuck);
    const failed = await runVerifyPass(
      TEXT,
      CHUNKS,
      { finder: fakeFinder(QUOTES), verifier: failing.verifier },
      never,
    );
    expect(failed).toEqual({ ok: false, error: stuck });
    expect(failing.calls).toHaveLength(1);
    const cancelled = fakeVerifier(judge);
    const result = await runVerifyPass(
      TEXT,
      CHUNKS,
      { finder: fakeFinder(QUOTES), verifier: cancelled.verifier },
      () => true,
    );
    expect(!result.ok && result.error.kind).toBe('Cancelled');
    expect(cancelled.calls).toEqual([]);
  });

  it('sums the retries of every call', async () => {
    const { verifier } = fakeVerifier(judge, { retries: 1 });
    const result = await runVerifyPass(
      TEXT,
      CHUNKS,
      { finder: fakeFinder(QUOTES), verifier },
      never,
    );
    expect(result.ok && result.value.retries).toBe(2);
  });
});
