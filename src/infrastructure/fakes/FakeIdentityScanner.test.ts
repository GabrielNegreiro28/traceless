import { describe, expect, it } from 'vitest';
import { toRawText } from '../../domain/text/brandedText';
import { createAppError } from '../../shared/appError';
import { FakeClock } from './FakeClock';
import { FakeIdentityScanner } from './FakeIdentityScanner';

const finding = { quote: 'my desk', category: 'LOCATION', reason: 'r', suggestion: null } as const;

describe('FakeIdentityScanner', () => {
  it('returns no findings on device by default and records the chunk', async () => {
    const fake = new FakeIdentityScanner();
    const result = await fake.scan(toRawText('a'));
    expect(result).toEqual({
      ok: true,
      value: { findings: [], protectedQuotes: [], source: 'ON_DEVICE', retries: 0 },
    });
    expect(fake.chunks).toEqual(['a']);
  });

  it('plays steps in order, then falls back to respond()', async () => {
    const error = createAppError('OnDeviceUnavailable', { message: 'no model' });
    const fake = new FakeIdentityScanner({
      steps: [
        { findings: [finding], protectedQuotes: ['the boss'], source: 'IN_CLOUD', retries: 1 },
        { error },
      ],
      respond: (_chunk, callIndex) => ({ findings: [{ ...finding, reason: `call ${callIndex}` }] }),
    });
    const first = await fake.scan(toRawText('a'));
    const second = await fake.scan(toRawText('b'));
    const third = await fake.scan(toRawText('c'));
    expect(first).toEqual({
      ok: true,
      value: { findings: [finding], protectedQuotes: ['the boss'], source: 'IN_CLOUD', retries: 1 },
    });
    expect(second).toEqual({ ok: false, error });
    expect(third.ok && third.value.findings[0]?.reason).toBe('call 2');
  });

  it('uses the configured default source', async () => {
    const fake = new FakeIdentityScanner({ source: 'IN_CLOUD' });
    const result = await fake.scan(toRawText('a'));
    expect(result.ok && result.value.source).toBe('IN_CLOUD');
  });

  it('detects overlapping calls through its event log', async () => {
    const fake = new FakeIdentityScanner();
    await Promise.all([fake.scan(toRawText('a')), fake.scan(toRawText('b'))]);
    expect(fake.maxConcurrent).toBe(2);
    expect(fake.events).toEqual(['start:0', 'start:1', 'end:0', 'end:1']);
  });
});

describe('FakeClock', () => {
  it('advances by the step on every read and on demand', () => {
    const clock = new FakeClock(100, 5);
    expect(clock.now()).toBe(100);
    clock.advance(10);
    expect(clock.now()).toBe(115);
  });
});
