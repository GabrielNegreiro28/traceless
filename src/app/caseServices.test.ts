import { afterEach, describe, expect, it, vi } from 'vitest';
import { approvedText } from '../application/usecases/submitReport.testKit';
import { FakeAuthService } from '../infrastructure/fakes/FakeAuthService';
import { FakeReportRepository } from '../infrastructure/fakes/FakeReportRepository';
import { createInMemoryPrivacyLedger } from '../infrastructure/ledger/inMemoryPrivacyLedger';
import { createAppError } from '../shared/appError';
import { bindCaseServices, DEMO_ORG_ID, type CaseBackend } from './caseServices';
import { createServices } from './compositionRoot';
import { FAKE_TEST_ENV } from './services/renderWithServices';

const TEXT = approvedText('Overtime was logged but never paid.');
const CLOCK = { now: () => 42 };

function setup(kind: 'onDevice' | 'demo') {
  const backend: CaseBackend & { repository: FakeReportRepository } = {
    auth: new FakeAuthService(),
    repository: new FakeReportRepository(),
  };
  const ledger = createInMemoryPrivacyLedger();
  return { backend, ledger, services: bindCaseServices(backend, ledger, CLOCK, kind) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bindCaseServices', () => {
  it('records one SANITIZED submit entry from the cloud, with no content', async () => {
    const { ledger, services } = setup('onDevice');
    const result = await services.submitReport(TEXT, services.issueCaseKey());
    expect(result.ok).toBe(true);
    expect(ledger.entries()).toEqual([
      { task: 'submit', source: 'cloud', dataClass: 'SANITIZED', demo: false, at: 42 },
    ]);
    expect(JSON.stringify(ledger.entries())).not.toContain('Overtime');
  });

  it('labels the demo backend as local demo, never as sent', async () => {
    const { ledger, services } = setup('demo');
    await services.submitReport(TEXT, services.issueCaseKey());
    expect(ledger.entries()).toMatchObject([{ task: 'submit', source: 'local', demo: true }]);
  });

  it('records nothing when the send fails', async () => {
    const { backend, ledger, services } = setup('onDevice');
    backend.repository.failWith(createAppError('PermissionDenied', { message: 'rules' }));
    await services.submitReport(TEXT, services.issueCaseKey());
    expect(ledger.entries()).toEqual([]);
  });

  it('uses the browser connectivity: offline sends nothing', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { backend, services } = setup('onDevice');
    await expect(services.submitReport(TEXT, services.issueCaseKey())).resolves.toMatchObject({
      ok: false,
      error: { kind: 'Offline' },
    });
    expect(backend.repository.submitted).toEqual([]);
  });

  it('issues a different 22-character key every time (crypto random)', () => {
    const { services } = setup('onDevice');
    const first = services.issueCaseKey();
    expect(first).toMatch(/^[0-9A-Za-z]{22}$/);
    expect(services.issueCaseKey()).not.toBe(first);
  });
});

describe('createServices: sending', () => {
  it('sends to the demo organization id', () => {
    expect(DEMO_ORG_ID).toBe('acme-demo');
  });

  it('uses an in-memory backend in fake AI mode and shares it with the follow-up', async () => {
    const services = createServices(FAKE_TEST_ENV);
    const sent = await services.submitReport(TEXT, services.issueCaseKey());
    if (!sent.ok) throw new Error('submit failed');
    await expect(services.lookUpCase(sent.value.caseKey)).resolves.toMatchObject({
      ok: true,
      value: { sanitizedText: TEXT, status: 'received' },
    });
  });
});
