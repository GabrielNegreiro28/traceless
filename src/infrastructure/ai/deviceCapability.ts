import type { GenerativeModel } from 'firebase/ai';
import {
  DEVICE_AVAILABILITIES,
  type DeviceAvailability,
} from '../../application/ports/DeviceCapability';
import type { AppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import { err, ok, type Result } from '../../shared/result';
import { mapAiError } from './errorMapper';
import { onDeviceTextOptions, readLanguageModel } from './languageModelGlobal';

export interface DeviceCapabilityEnv {
  /** Where to look for the Prompt API global (tests inject one); default `globalThis`. */
  readonly globalObject?: object;
}

/** The only model method `prepare` needs (GenerativeModel satisfies it). */
export type DeviceModel = Pick<GenerativeModel, 'initializeDeviceModel'>;

export interface ChromeDeviceCapability {
  check(): Promise<DeviceAvailability>;
  prepare(
    model: DeviceModel,
    onProgress: (fraction: number) => void,
  ): Promise<Result<void, AppError>>;
}

function isDeviceAvailability(value: unknown): value is DeviceAvailability {
  return (DEVICE_AVAILABILITIES as readonly unknown[]).includes(value);
}

function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

async function checkAvailability(globalObject: object): Promise<DeviceAvailability> {
  const languageModel = readLanguageModel(globalObject);
  if (languageModel === undefined) return 'unavailable';
  try {
    const value = await languageModel.availability(onDeviceTextOptions());
    return isDeviceAvailability(value) ? value : 'unavailable';
  } catch {
    logger.warn('on-device availability check failed');
    return 'unavailable';
  }
}

/**
 * Downloads/initializes the on-device model through the SDK:
 * `GenerativeModel.initializeDeviceModel(onDownloadProgress?: (progressValue: number) =>
 * void): Promise<void>` (@firebase/ai dist/ai-public.d.ts l.1118; implementation
 * dist/esm/index.esm.js l.3313-3330). MUST run inside a user gesture (click): Chrome
 * rejects a download started without user activation.
 */
async function prepareModel(
  model: DeviceModel,
  onProgress: (fraction: number) => void,
): Promise<Result<void, AppError>> {
  try {
    await model.initializeDeviceModel((progress) => onProgress(clampFraction(progress)));
    return ok(undefined);
  } catch (error) {
    return err(mapAiError(error));
  }
}

/**
 * Chrome on-device capability. `check()` asks `LanguageModel.availability()` with the
 * exact text-only English options the models use; a missing global or a thrown error
 * reads as 'unavailable' (never throws).
 */
export function createDeviceCapability(env: DeviceCapabilityEnv = {}): ChromeDeviceCapability {
  const globalObject = env.globalObject ?? globalThis;
  return {
    check: () => checkAvailability(globalObject),
    prepare: prepareModel,
  };
}
