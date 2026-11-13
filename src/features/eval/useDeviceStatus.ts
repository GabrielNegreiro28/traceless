import { useCallback, useEffect, useState } from 'react';
import type {
  DeviceAvailability,
  DeviceCapability,
} from '../../application/ports/DeviceCapability';
import type { AppError } from '../../shared/appError';

export interface DeviceStatus {
  /** null while the first check is running. */
  readonly availability: DeviceAvailability | null;
  /** 0 to 1 while preparing, otherwise null. */
  readonly progress: number | null;
  readonly error: AppError | null;
  /** Must be called from a click handler (Chrome needs a user gesture to download). */
  readonly prepare: () => void;
}

/** Tracks whether the on-device model is ready and lets the user start its download. */
export function useDeviceStatus(capability: DeviceCapability): DeviceStatus {
  const [availability, setAvailability] = useState<DeviceAvailability | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    let active = true;
    void capability.check().then((value) => {
      if (active) setAvailability(value);
    });
    return () => {
      active = false;
    };
  }, [capability]);

  const prepare = useCallback(() => {
    setError(null);
    setProgress(0);
    void (async () => {
      const result = await capability.prepare(setProgress);
      if (!result.ok) setError(result.error);
      setProgress(null);
      setAvailability(await capability.check());
    })();
  }, [capability]);

  return { availability, progress, error, prepare };
}
