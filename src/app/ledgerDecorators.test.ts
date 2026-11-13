import { describe, expect, it, vi } from 'vitest';
import type { ScanReportResult } from '../application/usecases/scanReport';
import { toRawText } from '../domain/text/brandedText';
import { FakeClock } from '../infrastructure/fakes/FakeClock';
import { createInMemoryPrivacyLedger } from '../infrastructure/ledger/inMemoryPrivacyLedger';
import { createAppError } from '../shared/appError';
import { err, ok } from '../shared/result';
import type { Services } from './compositionRoot';
import { ledgerView, withApprovalLedger, withScanLedger } from './ledgerDecorators';
import { createFakeServices } from './services/renderWithServices';

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

const scanReturning = (outcome: Awaited<ReturnType<Services['scanReport']>>) =>
  vi.fn<Services['scanReport']>(() => Promise.resolve(outcome));

describe('withScanLedger', () => {
  it('records an on-device RAW scan from the result source (real scanner)', async () => {
    const ledger = createInMemoryPrivacyLedger();
    const scan = withScanLedger(
      scanReturning(ok(scanResult('ON_DEVICE'))),
      ledger,
      new FakeClock(5),
      'onDevice',
    );
    await scan(TEXT);
    expect(ledger.entries()).toEqual([
      { task: 'identityScan', source: 'onDevice', dataClass: 'RAW', demo: false, at: 5 },
    ]);
  });

  it('records cloud when the result says the scan ran in the cloud', async () => {
    const ledger = createInMemoryPrivacyLedger();
    const inner = scanReturning(ok(scanResult('IN_CLOUD')));
    await withScanLedger(inner, ledger, new FakeClock(), 'onDevice')(TEXT);
    expect(ledger.entries()[0]?.source).toBe('cloud');
  });

  it('labels the demo scanner as local, never as on-device AI', async () => {
    const ledger = createInMemoryPrivacyLedger();
    const inner = scanReturning(ok(scanResult('ON_DEVICE')));
    await withScanLedger(inner, ledger, new FakeClock(), 'demo')(TEXT);
    expect(ledger.entries()[0]).toMatchObject({ source: 'local', demo: true });
  });

  it('records nothing for a failed scan and passes every argument through', async () => {
    const ledger = createInMemoryPrivacyLedger();
    const inner = scanReturning(err(createAppError('Cancelled', { message: 'x' })));
    const onProgress = vi.fn();
    const isCancelled = () => true;
    const scan = withScanLedger(inner, ledger, new FakeClock(), 'onDevice');
    const result = await scan(TEXT, onProgress, isCancelled);
    expect(result.ok).toBe(false);
    expect(inner).toHaveBeenCalledWith(TEXT, onProgress, isCancelled);
    expect(ledger.entries()).toEqual([]);
  });
});

describe('withApprovalLedger', () => {
  const input = { text: TEXT, findings: [], decisions: [], acknowledgedRemainingRisk: false };

  it('records a SANITIZED approval at the approval time', () => {
    const ledger = createInMemoryPrivacyLedger();
    const result = withApprovalLedger(createFakeServices().approveReport, ledger)(input);
    if (!result.ok) throw new Error('expected approval');
    expect(ledger.entries()).toEqual([
      {
        task: 'approve',
        source: 'local',
        dataClass: 'SANITIZED',
        demo: false,
        at: result.value.approvedAt,
      },
    ]);
  });

  it('records nothing for a refused approval', () => {
    const ledger = createInMemoryPrivacyLedger();
    const refuse = () => err(createAppError('EmptyReport', { message: 'x' }));
    withApprovalLedger(refuse, ledger)(input);
    expect(ledger.entries()).toEqual([]);
  });
});

describe('ledgerView', () => {
  it('exposes only reading and subscribing', () => {
    const ledger = createInMemoryPrivacyLedger();
    const view = ledgerView(ledger);
    expect(Object.keys(view).sort()).toEqual(['entries', 'subscribe']);
    const listener = vi.fn();
    view.subscribe(listener);
    ledger.record({ task: 'approve', source: 'local', dataClass: 'SANITIZED', demo: false, at: 1 });
    expect(view.entries()).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
