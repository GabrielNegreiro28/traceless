import type {
  DeviceAvailability,
  DeviceCapability,
} from '../../application/ports/DeviceCapability';
import type { AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';

export interface FakeDeviceCapabilityOptions {
  /** What `check()` answers (default: 'available'). */
  readonly availability?: DeviceAvailability;
  /** Progress values `prepare()` reports, in order (default: [1]). */
  readonly progress?: readonly number[];
  /** When set, `prepare()` fails with this error after reporting progress. */
  readonly prepareError?: AppError;
}

/**
 * Deterministic DeviceCapability for tests, E2E and demo mode: no Chrome API, no
 * timers. After a successful `prepare()` the device reads as 'available'.
 */
export class FakeDeviceCapability implements DeviceCapability {
  prepareCalls = 0;
  private availability: DeviceAvailability;
  private readonly options: FakeDeviceCapabilityOptions;

  constructor(options: FakeDeviceCapabilityOptions = {}) {
    this.options = options;
    this.availability = options.availability ?? 'available';
  }

  check(): Promise<DeviceAvailability> {
    return Promise.resolve(this.availability);
  }

  prepare(onProgress: (fraction: number) => void): Promise<Result<void, AppError>> {
    this.prepareCalls += 1;
    for (const fraction of this.options.progress ?? [1]) onProgress(fraction);
    if (this.options.prepareError !== undefined) {
      return Promise.resolve(err(this.options.prepareError));
    }
    this.availability = 'available';
    return Promise.resolve(ok(undefined));
  }
}
