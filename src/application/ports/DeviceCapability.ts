import type { AppError } from '../../shared/appError';
import type { Result } from '../../shared/result';

/** Chrome Prompt API availability for text-only English input and output. */
export type DeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export const DEVICE_AVAILABILITIES: readonly DeviceAvailability[] = [
  'available',
  'downloadable',
  'downloading',
  'unavailable',
];

/** Whether this device can run the on-device model, and how to get it ready. */
export interface DeviceCapability {
  /** Never throws; any failure reads as 'unavailable'. */
  check(): Promise<DeviceAvailability>;
  /**
   * Downloads and initializes the on-device model, reporting progress from 0 to 1.
   * MUST be called from a user gesture (a click handler): Chrome refuses to start a
   * model download without user activation.
   */
  prepare(onProgress: (fraction: number) => void): Promise<Result<void, AppError>>;
}
