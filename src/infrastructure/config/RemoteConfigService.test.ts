import type { FirebaseApp } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOUD_MODEL_NAME } from '../../ai/policy/inferencePolicy';
import { DEFAULT_APP_CONFIG } from '../../application/ports/ConfigService';
import { REMOTE_CONFIG_DEFAULTS } from '../firebase/remoteConfigDefaults';
import { createRemoteConfigService } from './RemoteConfigService';

const sdk = vi.hoisted(() => ({
  instance: {
    defaultConfig: {},
    settings: { fetchTimeoutMillis: 0, minimumFetchIntervalMillis: 0 },
  },
  getRemoteConfig: vi.fn(),
  fetchAndActivate: vi.fn(),
  getBoolean: vi.fn(),
  isSupported: vi.fn(),
}));

vi.mock('firebase/remote-config', () => ({
  getRemoteConfig: sdk.getRemoteConfig,
  fetchAndActivate: sdk.fetchAndActivate,
  getBoolean: sdk.getBoolean,
  isSupported: sdk.isSupported,
}));

const APP = { name: 'test' } as unknown as FirebaseApp;
const OPTIONS = { timeoutMs: 50, minimumFetchIntervalMs: 1000 };

describe('createRemoteConfigService', () => {
  beforeEach(() => {
    sdk.getRemoteConfig.mockReturnValue(sdk.instance);
    sdk.isSupported.mockResolvedValue(true);
    sdk.fetchAndActivate.mockResolvedValue(true);
    sdk.getBoolean.mockReturnValue(true);
  });

  it('applies the defaults and settings, fetches once and reads the kill switch', async () => {
    const service = createRemoteConfigService(() => APP, OPTIONS);
    sdk.getBoolean.mockReturnValue(false);
    await expect(service.load()).resolves.toEqual({ cloudScanEnabled: false });
    await expect(service.load()).resolves.toEqual({ cloudScanEnabled: false });
    expect(sdk.fetchAndActivate).toHaveBeenCalledOnce();
    expect(sdk.getBoolean).toHaveBeenCalledWith(sdk.instance, 'cloud_scan_enabled');
    expect(sdk.instance.defaultConfig).toEqual(REMOTE_CONFIG_DEFAULTS);
    expect(sdk.instance.settings).toEqual({
      fetchTimeoutMillis: 50,
      minimumFetchIntervalMillis: 1000,
    });
  });

  it('falls back to the activated defaults when the fetch fails', async () => {
    sdk.fetchAndActivate.mockRejectedValue(new Error('offline'));
    const service = createRemoteConfigService(() => APP, OPTIONS);
    await expect(service.load()).resolves.toEqual({ cloudScanEnabled: true });
  });

  it('does not wait past the deadline for a hanging fetch', async () => {
    sdk.fetchAndActivate.mockReturnValue(new Promise(() => undefined));
    const service = createRemoteConfigService(() => APP, OPTIONS);
    await expect(service.load()).resolves.toEqual({ cloudScanEnabled: true });
  });

  it('uses the in-code defaults where Remote Config cannot run, without touching Firebase', async () => {
    sdk.isSupported.mockResolvedValue(false);
    const getApp = vi.fn(() => APP);
    const service = createRemoteConfigService(getApp, OPTIONS);
    await expect(service.load()).resolves.toEqual(DEFAULT_APP_CONFIG);
    expect(getApp).not.toHaveBeenCalled();
    expect(sdk.fetchAndActivate).not.toHaveBeenCalled();
  });

  it('never rejects, even when the app cannot be created', async () => {
    const service = createRemoteConfigService(() => {
      throw new Error('no app');
    }, OPTIONS);
    await expect(service.load()).resolves.toEqual(DEFAULT_APP_CONFIG);
  });

  it('agrees with the template defaults and the policy', () => {
    expect(DEFAULT_APP_CONFIG.cloudScanEnabled).toBe(REMOTE_CONFIG_DEFAULTS.cloud_scan_enabled);
    expect(REMOTE_CONFIG_DEFAULTS.cloud_model_name).toBe(CLOUD_MODEL_NAME);
  });
});
