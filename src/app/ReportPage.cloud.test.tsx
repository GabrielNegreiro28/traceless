import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_PACK } from '../domain/detection/rulePacks';
import { FakeClock } from '../infrastructure/fakes/FakeClock';
import { FakeConfigService } from '../infrastructure/fakes/FakeConfigService';
import { FakeConsentedIdentityScanner } from '../infrastructure/fakes/FakeConsentedIdentityScanner';
import { FakeDeviceCapability } from '../infrastructure/fakes/FakeDeviceCapability';
import { createInMemoryPrivacyLedger } from '../infrastructure/ledger/inMemoryPrivacyLedger';
import { bindCloudScan } from './cloudAi';
import type { Services } from './compositionRoot';
import { ledgerView, withCloudScanLedger } from './ledgerDecorators';
import { createAppRoutes } from './router';
import { renderWithServices } from './services/renderWithServices';

/**
 * The consented cloud path end to end on fake services: sample → one-click consent → review.
 * `cloudServices` puts a fake cloud scanner behind a non-demo app (`demoAi: false`), so
 * the cloud badge, chip and ledger line can be checked as a judge without Nano would see them.
 */
function cloudServices(): Partial<Services> {
  const ledger = createInMemoryPrivacyLedger();
  const config = new FakeConfigService();
  const settings = { chunkChars: 1500, postFilters: [], rulePack: DEFAULT_RULE_PACK } as const;
  const scan = bindCloudScan(new FakeConsentedIdentityScanner(), config, settings);
  return {
    deviceCapability: new FakeDeviceCapability({ availability: 'unavailable' }),
    scanWithCloudConsent: withCloudScanLedger(scan, ledger, new FakeClock(1, 1), 'onDevice'),
    privacyLedger: ledgerView(ledger),
    config,
    demoAi: false,
  };
}

function openReport(overrides: Partial<Services>) {
  const router = createMemoryRouter(createAppRoutes([]), { initialEntries: ['/report'] });
  return renderWithServices(<RouterProvider router={router} />, overrides);
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const click = async (name: string) => userEvent.click(await screen.findByRole('button', { name }));

/** Opens the privacy ledger (a closed <details>) and returns its list of steps. */
async function openLedger(): Promise<HTMLElement> {
  await userEvent.click(screen.getByText('What happened to your text'));
  return screen.getByRole('list', { name: 'Steps so far' });
}

async function checkSampleInCloud(): Promise<void> {
  await heading('Write your report');
  await click('Try a sample report');
  await click('Check my report');
  await heading('Choose how to check your report');
  await click('Check the sample in the cloud');
  await heading('Review your report');
}

describe('/report consented cloud check', () => {
  it('reviews the sample with the cloud badge, the cloud chip and the cloud ledger line', async () => {
    openReport(cloudServices());
    await checkSampleInCloud();
    expect(screen.getByText('Cloud mode (with your consent)')).toBeVisible();
    expect(screen.getByText('Checked in the cloud, with your consent')).toBeVisible();
    const ledger = await openLedger();
    expect(
      within(ledger).getByText(
        'Identity scan · in the cloud, with your consent · your original text, sent for this scan only',
      ),
    ).toBeVisible();
  });

  it('in demo mode never claims a cloud check: the demo scanner stands in', async () => {
    openReport({ deviceCapability: new FakeDeviceCapability({ availability: 'unavailable' }) });
    await checkSampleInCloud();
    expect(screen.getByText('Cloud mode demo (nothing leaves this device)')).toBeVisible();
    expect(screen.getByText('Checked by the demo scanner (no AI)')).toBeVisible();
    expect(screen.queryByText('Cloud mode (with your consent)')).not.toBeInTheDocument();
    const ledger = await openLedger();
    expect(within(ledger).getByText(/on your device \(demo scanner\)/)).toBeVisible();
  });
});
