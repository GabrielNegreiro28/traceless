import { describe, expect, it } from 'vitest';
import type { Finding } from '../domain/detection/types';
import type { ReviewDecision } from '../domain/rewrite/reviewDecision';
import { toRawText } from '../domain/text/brandedText';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { createServices, type Services } from './compositionRoot';
import { FAKE_TEST_ENV } from './services/renderWithServices';

const REPORT = toRawText(
  'Quartermaster Wexford falsified 9172 manifests at Zebrafish Wharf. Reach me at q.wex@harbor.example.',
);

/** Every substring of `text` with exactly `size` characters. */
function substrings(text: string, size: number): Set<string> {
  const found = new Set<string>();
  for (let i = 0; i + size <= text.length; i++) found.add(text.slice(i, i + size));
  return found;
}

const acceptAll = (findings: readonly Finding[]): ReviewDecision[] =>
  findings.map((f) => ({ findingId: f.id, action: 'ACCEPTED' }));

/** Scans REPORT, then approves it with every finding accepted. */
async function scanAndApprove(services: Services): Promise<void> {
  const scanned = await services.scanReport(REPORT);
  if (!scanned.ok) throw new Error(scanned.error.kind);
  const approved = services.approveReport({
    text: REPORT,
    findings: scanned.value.findings,
    decisions: acceptAll(scanned.value.findings),
    acknowledgedRemainingRisk: true,
  });
  if (!approved.ok) throw new Error(approved.error.kind);
}

describe('createServices: privacy ledger wiring (fake AI mode)', () => {
  it('records the scan and the approval, labelled as the demo scanner', async () => {
    const services = createServices(FAKE_TEST_ENV);
    expect(services.privacyLedger.entries()).toEqual([]);
    await scanAndApprove(services);
    expect(services.privacyLedger.entries()).toMatchObject([
      { task: 'identityScan', source: 'local', dataClass: 'RAW', demo: true },
      { task: 'approve', source: 'local', dataClass: 'SANITIZED', demo: false },
    ]);
  });

  it('keeps no part of the report in the ledger', async () => {
    const fakeScanner = new FakeIdentityScanner({
      respond: () => ({
        findings: [
          { quote: 'Zebrafish Wharf', category: 'LOCATION', reason: 'r', suggestion: null },
        ],
        protectedQuotes: ['Quartermaster Wexford'],
      }),
    });
    const services = createServices(FAKE_TEST_ENV, { fakeScanner });
    await scanAndApprove(services);
    expect(fakeScanner.chunks).toEqual([REPORT]);
    expect(services.privacyLedger.entries()).toHaveLength(2);
    const serialized = JSON.stringify(services.privacyLedger.entries());
    for (const part of substrings(REPORT, 5)) expect(serialized).not.toContain(part);
  });

  it('hands features only the read side of the ledger', () => {
    const services = createServices(FAKE_TEST_ENV);
    expect('record' in services.privacyLedger).toBe(false);
  });
});
