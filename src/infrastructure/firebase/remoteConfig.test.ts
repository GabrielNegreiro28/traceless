import type { FirebaseApp } from 'firebase/app';
import { describe, expect, it, vi } from 'vitest';
import { getRemoteConfigService } from './remoteConfig';
import { REMOTE_CONFIG_DEFAULTS } from './remoteConfigDefaults';

const sdk = vi.hoisted(() => ({
  getRemoteConfig: vi.fn(() => ({ defaultConfig: {} })),
  fetchAndActivate: vi.fn(),
}));

vi.mock('firebase/remote-config', () => sdk);

describe('getRemoteConfigService', () => {
  it('applies the in-code defaults without fetching', () => {
    const remoteConfig = getRemoteConfigService({ name: 'test' } as unknown as FirebaseApp);

    expect(remoteConfig.defaultConfig).toEqual(REMOTE_CONFIG_DEFAULTS);
    expect(sdk.fetchAndActivate).not.toHaveBeenCalled();
  });
});
