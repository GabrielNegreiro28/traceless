import { describe, expect, it } from 'vitest';
import { approvedText } from '../application/usecases/submitReport.testKit';
import { FakeReportStructurer } from '../infrastructure/fakes/FakeReportStructurer';
import { createInMemoryPrivacyLedger } from '../infrastructure/ledger/inMemoryPrivacyLedger';
import { createAppError } from '../shared/appError';
import { bindStructureReport } from './structureServices';

const TEXT = approvedText('A manager approved false invoices.');
const CLOCK = { now: () => 42 };

function run(structurer: FakeReportStructurer, kind: 'onDevice' | 'demo') {
  const ledger = createInMemoryPrivacyLedger();
  const structure = bindStructureReport(structurer, ledger, CLOCK, kind);
  return { ledger, structure };
}

describe('structureReport ledger', () => {
  it.each([
    ['ON_DEVICE', 'onDevice'],
    ['IN_CLOUD', 'cloud'],
  ] as const)('records source %s as %s, SANITIZED, with no content', async (source, expected) => {
    const { ledger, structure } = run(new FakeReportStructurer({ source }), 'onDevice');
    await structure(TEXT);
    expect(ledger.entries()).toEqual([
      { task: 'structureReport', source: expected, dataClass: 'SANITIZED', demo: false, at: 42 },
    ]);
    expect(JSON.stringify(ledger.entries())).not.toContain('invoices');
  });

  it('records the demo structurer as local, never as AI', async () => {
    const { ledger, structure } = run(new FakeReportStructurer(), 'demo');
    await structure(TEXT);
    expect(ledger.entries()).toMatchObject([{ source: 'local', demo: true }]);
  });

  it('records nothing when structuring fails', async () => {
    const error = createAppError('Offline', { message: 'offline' });
    const { ledger, structure } = run(new FakeReportStructurer({ error }), 'onDevice');
    expect(await structure(TEXT)).toEqual({ ok: false, error });
    expect(ledger.entries()).toEqual([]);
  });
});
