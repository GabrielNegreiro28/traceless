import { useEffect, useState } from 'react';
import { useServices } from '../../app/services/useServices';

/** Whether the consented cloud scan may be offered (Remote Config `cloud_scan_enabled`). */
export type CloudAvailability = 'checking' | 'enabled' | 'disabled';

/**
 * Reads the kill switch once per mount. The config service never rejects (it falls back to
 * the in-code default); if it did anyway, the cloud option stays hidden: nothing is sent.
 */
export function useCloudScanAvailability(): CloudAvailability {
  const { config } = useServices();
  const [availability, setAvailability] = useState<CloudAvailability>('checking');
  useEffect(() => {
    let live = true;
    config.load().then(
      (loaded) => {
        if (live) setAvailability(loaded.cloudScanEnabled ? 'enabled' : 'disabled');
      },
      () => {
        if (live) setAvailability('disabled');
      },
    );
    return () => {
      live = false;
    };
  }, [config]);
  return availability;
}
