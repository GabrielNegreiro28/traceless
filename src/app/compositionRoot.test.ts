import { describe, expect, it, vi } from 'vitest';
import { toRawText } from '../domain/text/brandedText';
import { FakeDeviceCapability } from '../infrastructure/fakes/FakeDeviceCapability';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { createServices } from './compositionRoot';
import type { AppEnv } from './env';

const boot = vi.hoisted(() => ({ bootstrapFirebase: vi.fn() }));

vi.mock('./firebaseBootstrap', () => ({ bootstrapFirebase: boot.bootstrapFirebase }));

const FAKE_ENV: AppEnv = {
  firebase: {
    apiKey: 'test-api-key',
    authDomain: 'demo-traceless.firebaseapp.com',
    projectId: 'demo-traceless',
    storageBucket: 'demo-traceless.appspot.com',
    messagingSenderId: '0',
    appId: '1:0:web:0',
  },
  recaptchaSiteKey: 'test-site-key',
  aiMode: 'fake',
  useEmulators: true,
};

const SAMPLE = toRawText(
  [
    'I am the only night nurse on ward 7 and I have seen the head nurse falsify the drug log.',
    'You can reach me at night.nurse@example.com if you need more details.',
  ].join('\n\n'),
);

describe('createServices (fake AI mode)', () => {
  it('wires the deterministic fakes and never touches Firebase', () => {
    const services = createServices(FAKE_ENV);
    expect(services.identityScanner).toBeInstanceOf(FakeIdentityScanner);
    expect(services.deviceCapability).toBeInstanceOf(FakeDeviceCapability);
    expect(boot.bootstrapFirebase).not.toHaveBeenCalled();
  });

  it('scans a sample report end to end through scanReport', async () => {
    const services = createServices(FAKE_ENV);
    const progress: [number, number][] = [];
    const result = await services.scanReport(SAMPLE, (done, total) => progress.push([done, total]));
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.source).toBe('ON_DEVICE');
    expect(result.value.stats.chunks).toBe(1);
    expect(result.value.findings).toEqual([
      expect.objectContaining({ quote: 'the only night nurse', category: 'ROLE_UNIQUE' }),
      expect.objectContaining({
        quote: 'night.nurse@example.com',
        category: 'DIRECT_IDENTIFIER',
        origin: 'RULE',
      }),
    ]);
    expect(progress).toEqual([
      [0, 1],
      [1, 1],
    ]);
    const scanner = services.identityScanner as FakeIdentityScanner;
    expect(scanner.chunks).toEqual([SAMPLE]);
  });

  it('passes the cancellation check through to the scan', async () => {
    const services = createServices(FAKE_ENV);
    const result = await services.scanReport(SAMPLE, undefined, () => true);
    expect(result).toMatchObject({ ok: false, error: { kind: 'Cancelled' } });
    expect((services.identityScanner as FakeIdentityScanner).chunks).toHaveLength(0);
  });

  it('works without a progress callback and reports the device as ready', async () => {
    const services = createServices(FAKE_ENV);
    expect((await services.scanReport(SAMPLE)).ok).toBe(true);
    await expect(services.deviceCapability.check()).resolves.toBe('available');
    await expect(services.deviceCapability.prepare(() => undefined)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
  });
});
