import { describe, expect, it, vi } from 'vitest';
import type { ScanReportResult } from '../application/usecases/scanReport';
import { toRawText } from '../domain/text/brandedText';
import { FakeClock } from '../infrastructure/fakes/FakeClock';
import { createInMemoryPrivacyLedger } from '../infrastructure/ledger/inMemoryPrivacyLedger';
import { createAppError } from '../shared/appError';
import { err, ok } from '../shared/result';
import type { Services } from './compositionRoot';
import { withCloudScanLedger } from './ledgerDecorators';

const TEXT = toRawText('Short report.');

function scanResult(source: ScanReportResult['source']): ScanReportResult {
  return {
    findings: [],
    modelFindings: [],
    raw: { findings: [], modelFindings: [] },
    protectedSpans: [],
    source,
    stats: {
      chunks: 1,
      rawModelFindings: 0,
      locatedModelFindings: 0,
      unlocatedModelFindings: 0,
      suppressed: 0,
      retries: 0,
      durationMs: 0,
    },
  };
}

const cloudScanReturning = (outcome: Awaited<ReturnType<Services['scanWithCloudConsent']>>) =>
  vi.fn<Services['scanWithCloudConsent']>(() => Promise.resolve(outcome));

describe('withCloudScanLedger', () => {
  it('records a consented-raw cloud scan, distinct from an on-device scan', async () => {
    const ledger = createInMemoryPrivacyLedger();
    const scan = cloudScanReturning(ok(scanResult('IN_CLOUD')));
    const decorated = withCloudScanLedger(scan, ledger, new FakeClock(7, 1), 'onDevice');
    const consent = { kind: 'own-text', acknowledged: true } as const;
    await decorated(TEXT, consent);
    expect(scan).toHaveBeenCalledWith(TEXT, consent, undefined, undefined);
    expect(ledger.entries()).toEqual([
      { task: 'identityScan', source: 'cloud', dataClass: 'CONSENTED_RAW', demo: false, at: 7 },
    ]);
  });

  it('labels the demo scanner as local, never as the cloud', async () => {
    const ledger = createInMemoryPrivacyLedger();
    const scan = cloudScanReturning(ok(scanResult('IN_CLOUD')));
    await withCloudScanLedger(scan, ledger, new FakeClock(0, 1), 'demo')(TEXT, { kind: 'sample' });
    expect(ledger.entries()).toMatchObject([
      { source: 'local', dataClass: 'CONSENTED_RAW', demo: true },
    ]);
  });

  it('records nothing for a refused or failed scan', async () => {
    const ledger = createInMemoryPrivacyLedger();
    for (const kind of ['ConsentRequired', 'CloudScanDisabled', 'ContentBlocked'] as const) {
      const scan = cloudScanReturning(err(createAppError(kind, { message: 'x' })));
      await withCloudScanLedger(
        scan,
        ledger,
        new FakeClock(0, 1),
        'onDevice',
      )(TEXT, {
        kind: 'sample',
      });
    }
    expect(ledger.entries()).toEqual([]);
  });
});
