import { DEFAULT_APP_CONFIG } from '../application/ports/ConfigService';
import { describe, expect, it } from 'vitest';
import type { CloudScanConsent } from '../application/usecases/consentToCloudScan';
import { SAMPLE_REPORT } from '../domain/report/sampleReport';
import { toRawText } from '../domain/text/brandedText';
import { FakeConfigService } from '../infrastructure/fakes/FakeConfigService';
import { FakeConsentedIdentityScanner } from '../infrastructure/fakes/FakeConsentedIdentityScanner';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { createServices } from './compositionRoot';
import { FAKE_TEST_ENV } from './services/renderWithServices';

const REPORT = toRawText('Quartermaster Wexford falsified 9172 manifests at Zebrafish Wharf.');
const OWN_TEXT: CloudScanConsent = { kind: 'own-text', acknowledged: true };

function servicesWith(config = new FakeConfigService()) {
  const fakeConsentedScanner = new FakeConsentedIdentityScanner();
  const fakeScanner = new FakeIdentityScanner();
  const services = createServices(FAKE_TEST_ENV, { fakeScanner, fakeConsentedScanner, config });
  return { services, fakeConsentedScanner, fakeScanner };
}

describe('createServices: consented cloud scan (fake AI mode)', () => {
  it('scans through the consented scanner only, and labels the demo scanner as such', async () => {
    const { services, fakeConsentedScanner, fakeScanner } = servicesWith();
    const result = await services.scanWithCloudConsent(REPORT, OWN_TEXT);
    expect(result.ok).toBe(true);
    expect(fakeConsentedScanner.chunks).toEqual([REPORT]);
    expect(fakeScanner.chunks).toEqual([]);
    expect(services.demoAi).toBe(true);
    expect(services.privacyLedger.entries()).toMatchObject([
      { task: 'identityScan', source: 'local', dataClass: 'CONSENTED_RAW', demo: true },
    ]);
  });

  it('refuses, records nothing and calls nothing while the kill switch is off', async () => {
    const { services, fakeConsentedScanner } = servicesWith(
      new FakeConfigService({ cloudScanEnabled: false }),
    );
    const result = await services.scanWithCloudConsent(toRawText(SAMPLE_REPORT), {
      kind: 'sample',
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'CloudScanDisabled' } });
    expect(fakeConsentedScanner.chunks).toEqual([]);
    expect(services.privacyLedger.entries()).toEqual([]);
  });

  it('refuses without a consent and keeps no part of the text in the ledger', async () => {
    const { services, fakeConsentedScanner } = servicesWith();
    const refused = await services.scanWithCloudConsent(
      REPORT,
      undefined as unknown as CloudScanConsent,
    );
    expect(refused).toMatchObject({ ok: false, error: { kind: 'ConsentRequired' } });
    expect(fakeConsentedScanner.chunks).toEqual([]);
    await services.scanWithCloudConsent(REPORT, OWN_TEXT);
    const serialized = JSON.stringify(services.privacyLedger.entries());
    for (const word of ['Wexford', '9172', 'Zebrafish']) expect(serialized).not.toContain(word);
  });

  it('exposes the default config service (cloud scan enabled) in fake mode', async () => {
    await expect(createServices(FAKE_TEST_ENV).config.load()).resolves.toEqual(DEFAULT_APP_CONFIG);
  });
});
