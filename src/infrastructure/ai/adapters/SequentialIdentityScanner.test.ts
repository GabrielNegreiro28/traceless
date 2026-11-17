import { describe, expect, it } from 'vitest';
import type { IdentityScanner } from '../../../application/ports/IdentityScanner';
import type { ModelFinding } from '../../../domain/detection/types';
import { toRawText } from '../../../domain/text/brandedText';
import { createAppError } from '../../../shared/appError';
import { err, ok } from '../../../shared/result';
import { SequentialIdentityScanner } from './SequentialIdentityScanner';

const CHUNK = toRawText('I drive the only snow plough on the north pass.');

function mf(quote: string, category: ModelFinding['category']): ModelFinding {
  return { quote, category, reason: 'r', suggestion: null };
}

function fixed(result: Awaited<ReturnType<IdentityScanner['scan']>>, log: string[], name: string) {
  return {
    scan: () => {
      log.push(name);
      return Promise.resolve(result);
    },
  } satisfies IdentityScanner;
}

describe('SequentialIdentityScanner', () => {
  it('runs the scanners in order and unions findings, protected quotes and retries', async () => {
    const log: string[] = [];
    const base = fixed(
      ok({
        findings: [mf('the only snow plough', 'ROLE_UNIQUE')],
        protectedQuotes: ['the depot boss'],
        source: 'ON_DEVICE',
        retries: 1,
      }),
      log,
      'base',
    );
    const investigator = fixed(
      ok({
        findings: [mf('the only snow plough', 'ROLE_UNIQUE'), mf('the north pass', 'LOCATION')],
        protectedQuotes: ['the depot boss', 'Hollis'],
        source: 'ON_DEVICE',
        retries: 0,
      }),
      log,
      'investigator',
    );
    const result = await new SequentialIdentityScanner([base, investigator]).scan(CHUNK);
    expect(log).toEqual(['base', 'investigator']);
    expect(result).toEqual(
      ok({
        findings: [mf('the only snow plough', 'ROLE_UNIQUE'), mf('the north pass', 'LOCATION')],
        protectedQuotes: ['the depot boss', 'Hollis'],
        source: 'ON_DEVICE',
        retries: 1,
      }),
    );
  });

  it('stops at the first failing scanner', async () => {
    const log: string[] = [];
    const failure = err(createAppError('PrivacyViolation', { message: 'off device' }));
    const first = fixed(failure, log, 'first');
    const second = fixed(
      ok({ findings: [], protectedQuotes: [], source: 'ON_DEVICE', retries: 0 }),
      log,
      'second',
    );
    expect(await new SequentialIdentityScanner([first, second]).scan(CHUNK)).toEqual(failure);
    expect(log).toEqual(['first']);
  });

  it('is IN_CLOUD as soon as one scanner was', async () => {
    const log: string[] = [];
    const onDevice = ok({
      findings: [],
      protectedQuotes: [],
      source: 'ON_DEVICE' as const,
      retries: 0,
    });
    const inCloud = ok({
      findings: [],
      protectedQuotes: [],
      source: 'IN_CLOUD' as const,
      retries: 0,
    });
    const scanner = new SequentialIdentityScanner([
      fixed(onDevice, log, 'a'),
      fixed(inCloud, log, 'b'),
    ]);
    const result = await scanner.scan(CHUNK);
    expect(result.ok && result.value.source).toBe('IN_CLOUD');
  });
});
