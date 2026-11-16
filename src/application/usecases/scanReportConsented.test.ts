import { describe, expect, it } from 'vitest';
import { toRawText, type ConsentedRawText } from '../../domain/text/brandedText';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeConsentedIdentityScanner } from '../../infrastructure/fakes/FakeConsentedIdentityScanner';
import { consentToCloudScan } from './consentToCloudScan';
import { scanReportConsented } from './scanReportConsented';

const TEXT = [
  'I am the only night nurse on ward 7.',
  'Write to me at jane.doe@example.com today.',
  'I sit at desk 14 near the exit.',
].join('\n\n');

/** Consented text obtained the one legitimate way, through consentToCloudScan. */
function consentedText(text: string): ConsentedRawText {
  const consent = { kind: 'own-text', acknowledged: true } as const;
  const result = consentToCloudScan(toRawText(text), consent, { cloudScanEnabled: true });
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}

describe('scanReportConsented', () => {
  it('accepts cloud chunks, reports IN_CLOUD and sums retries', async () => {
    const scanner = new FakeConsentedIdentityScanner({
      steps: [{ findings: [], retries: 1 }, { findings: [] }, { findings: [], retries: 1 }],
    });
    const result = await scanReportConsented(consentedText(TEXT), {
      scanner,
      clock: new FakeClock(1000, 25),
      chunkChars: 50,
    });
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.source).toBe('IN_CLOUD');
    expect(result.value.stats.retries).toBe(2);
    expect(scanner.chunks).toHaveLength(3);
  });

  it('only sends slices of the consented text', async () => {
    const scanner = new FakeConsentedIdentityScanner();
    await scanReportConsented(consentedText(TEXT), {
      scanner,
      clock: new FakeClock(0, 1),
      chunkChars: 50,
    });
    for (const chunk of scanner.chunks) expect(TEXT).toContain(chunk);
  });
});
