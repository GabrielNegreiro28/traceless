import { describe, expect, it } from 'vitest';
import type { ModelFinding } from '../../domain/detection/types';
import { SAMPLE_REPORT } from '../../domain/report/sampleReport';
import { toRawText, type RawText } from '../../domain/text/brandedText';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeConfigService } from '../../infrastructure/fakes/FakeConfigService';
import { FakeConsentedIdentityScanner } from '../../infrastructure/fakes/FakeConsentedIdentityScanner';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import { createAppError } from '../../shared/appError';
import type { CloudScanConsent } from './consentToCloudScan';
import { scanReport } from './scanReport';
import { scanReportConsented } from './scanReportConsented';
import { scanWithCloudConsent } from './scanWithCloudConsent';

const PARAGRAPHS = [
  'I am the only night nurse on ward 7.',
  'Write to me at jane.doe@example.com today.',
  'I sit at desk 14 near the exit.',
];
const TEXT = toRawText(PARAGRAPHS.join('\n\n'));
const CHUNK_CHARS = 50;
const OWN_TEXT: CloudScanConsent = { kind: 'own-text', acknowledged: true };

const mf = (quote: string, category: ModelFinding['category']): ModelFinding => ({
  quote,
  category,
  reason: 'model reason',
  suggestion: null,
});

function respond(chunk: string) {
  if (chunk.includes('night nurse')) return { findings: [mf('only night nurse', 'ROLE_UNIQUE')] };
  return { findings: [mf('desk 14', 'LOCATION'), mf('not in the text', 'LOCATION')] };
}

function setup(config = new FakeConfigService()) {
  const scanner = new FakeConsentedIdentityScanner({ respond });
  const progress: [number, number][] = [];
  const run = (text: RawText = TEXT, consent: CloudScanConsent = OWN_TEXT) =>
    scanWithCloudConsent(
      text,
      consent,
      { scanner, config, clock: new FakeClock(0, 10), chunkChars: CHUNK_CHARS },
      { onProgress: (done, total) => progress.push([done, total]) },
    );
  return { scanner, config, progress, run };
}

describe('scanWithCloudConsent', () => {
  it('never calls the cloud scanner without a consent object', async () => {
    const { scanner, config } = setup();
    const deps = { scanner, config, clock: new FakeClock(0, 1), chunkChars: CHUNK_CHARS };
    for (const missing of [undefined, null, {}]) {
      const result = await scanWithCloudConsent(TEXT, missing as CloudScanConsent, deps);
      expect(result).toMatchObject({ ok: false, error: { kind: 'ConsentRequired' } });
    }
    expect(scanner.chunks).toEqual([]);
  });

  it('never calls it for a sample consent on text one character away from the sample', async () => {
    const { scanner, run } = setup();
    const result = await run(toRawText(`${SAMPLE_REPORT}!`), { kind: 'sample' });
    expect(result).toMatchObject({ ok: false, error: { kind: 'ConsentRequired' } });
    expect(scanner.chunks).toEqual([]);
  });

  it('honours the kill switch read just before the scan', async () => {
    const config = new FakeConfigService();
    const { scanner, run } = setup(config);
    config.set({ cloudScanEnabled: false });
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: { kind: 'CloudScanDisabled' } });
    expect(scanner.chunks).toEqual([]);
    expect(config.loads).toBe(1);
  });

  it('scans the consented text in chunks through the shared pipeline', async () => {
    const { scanner, progress, run } = setup();
    const result = await run();
    if (!result.ok) throw new Error(result.error.kind);
    expect(scanner.chunks).toEqual(PARAGRAPHS);
    expect(result.value.source).toBe('IN_CLOUD');
    expect(result.value.findings.map((f) => [f.quote, f.origin])).toEqual([
      ['only night nurse', 'MODEL'],
      ['jane.doe@example.com', 'RULE'],
      ['desk 14', 'MODEL'],
    ]);
    expect(result.value.stats).toMatchObject({ chunks: 3, unlocatedModelFindings: 3 });
    expect(progress.at(-1)).toEqual([3, 3]);
  });

  it('accepts the unmodified sample with the one-click consent', async () => {
    const { scanner, run } = setup();
    const result = await run(toRawText(SAMPLE_REPORT), { kind: 'sample' });
    expect(result.ok).toBe(true);
    expect(scanner.chunks.join('')).toContain('forklift trainer');
  });

  it('fails the scan on a scanner error, as the on-device scan does', async () => {
    const error = createAppError('ContentBlocked', { message: 'blocked' });
    const scanner = new FakeConsentedIdentityScanner({ steps: [{ error }] });
    const result = await scanWithCloudConsent(TEXT, OWN_TEXT, {
      scanner,
      config: new FakeConfigService(),
      clock: new FakeClock(0, 1),
      chunkChars: CHUNK_CHARS,
    });
    expect(result).toEqual({ ok: false, error });
    expect(scanner.chunks).toHaveLength(1);
  });

  it('stops before the next chunk once cancelled', async () => {
    const scanner = new FakeConsentedIdentityScanner({ respond });
    let calls = 0;
    const result = await scanWithCloudConsent(
      TEXT,
      OWN_TEXT,
      { scanner, config: new FakeConfigService(), clock: new FakeClock(0, 1), chunkChars: 50 },
      { isCancelled: () => calls++ > 0 },
    );
    expect(result).toMatchObject({ ok: false, error: { kind: 'Cancelled' } });
    expect(scanner.chunks).toHaveLength(1);
  });
});

describe('the consented and on-device scans share one pipeline', () => {
  it('turn the same model answers into exactly the same findings', async () => {
    const settings = { clock: new FakeClock(0, 0), chunkChars: CHUNK_CHARS };
    const filters = { postFilters: ['protectedMentions', 'thirdPerson'] as const };
    const onDevice = await scanReport(TEXT, {
      ...settings,
      ...filters,
      scanner: new FakeIdentityScanner({ respond }),
    });
    const config = new FakeConfigService();
    const cloud = await scanWithCloudConsent(TEXT, OWN_TEXT, {
      ...settings,
      ...filters,
      config,
      scanner: new FakeConsentedIdentityScanner({ respond }),
    });
    if (!onDevice.ok || !cloud.ok) throw new Error('scan failed');
    expect(cloud.value.findings).toEqual(onDevice.value.findings);
    expect(cloud.value.modelFindings).toEqual(onDevice.value.modelFindings);
    expect([onDevice.value.source, cloud.value.source]).toEqual(['ON_DEVICE', 'IN_CLOUD']);
  });

  it('scanReportConsented accepts only consented text (type level)', () => {
    const scanner = new FakeConsentedIdentityScanner();
    const deps = { scanner, clock: new FakeClock(0, 0), chunkChars: CHUNK_CHARS };
    const neverRun = () =>
      // @ts-expect-error RawText must become ConsentedRawText through consentToCloudScan first
      scanReportConsented(TEXT, deps);
    expect(neverRun).toBeTypeOf('function');
    expect(scanner.chunks).toEqual([]);
  });
});
