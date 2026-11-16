import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_CONFIG,
  type AppConfig,
  type ConfigService,
} from '../../application/ports/ConfigService';
import { servicesWrapper } from '../review/useReportFlow.testKit';
import { useCloudScanAvailability } from './useCloudScanAvailability';

function configLoading(load: () => Promise<AppConfig>): ConfigService {
  return { load };
}

function renderAvailability(config: ConfigService) {
  return renderHook(() => useCloudScanAvailability(), { wrapper: servicesWrapper({ config }) });
}

describe('useCloudScanAvailability', () => {
  it('is checking until the config loads, then follows the kill switch', async () => {
    let resolve: (config: AppConfig) => void = () => undefined;
    const pending = new Promise<AppConfig>((r) => {
      resolve = r;
    });
    const { result } = renderAvailability(configLoading(() => pending));
    expect(result.current).toBe('checking');
    resolve({ ...DEFAULT_APP_CONFIG, cloudScanEnabled: true });
    await waitFor(() => expect(result.current).toBe('enabled'));
  });

  it('is disabled when the kill switch is off', async () => {
    const config = configLoading(() =>
      Promise.resolve({ ...DEFAULT_APP_CONFIG, cloudScanEnabled: false }),
    );
    const { result } = renderAvailability(config);
    await waitFor(() => expect(result.current).toBe('disabled'));
  });

  it('is disabled if loading the config ever rejects (nothing is offered, nothing sent)', async () => {
    const config = configLoading(() => Promise.reject(new Error('network')));
    const { result } = renderAvailability(config);
    await waitFor(() => expect(result.current).toBe('disabled'));
  });
});
