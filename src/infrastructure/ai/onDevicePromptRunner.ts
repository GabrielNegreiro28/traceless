import { InferenceSource } from 'firebase/ai';
import type {
  DeviceAvailability,
  DeviceCapability,
} from '../../application/ports/DeviceCapability';
import type { RawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { logger } from '../../shared/logger';
import { err, ok, type Result } from '../../shared/result';
import { withDeadline } from './deadline';
import { mapAiError } from './errorMapper';
import type { SerialQueue } from './serialQueue';

/** The slice of GenerativeModel the runner uses (GenerativeModel satisfies it). */
export interface PromptableModel {
  generateContent(prompt: string): Promise<{
    readonly response: { readonly inferenceSource?: InferenceSource; text(): string };
  }>;
}

export interface OnDeviceRunOutput {
  readonly text: string;
  readonly source: 'ON_DEVICE';
}

/** Sends one prompt over RAW text to the on-device model. */
export interface PromptRunner {
  run(prompt: RawText): Promise<Result<OnDeviceRunOutput, AppError>>;
}

export interface OnDevicePromptRunnerDeps {
  /** The ONE queue shared by every on-device runner (see serialQueue.ts). */
  readonly queue: SerialQueue;
  readonly capability: Pick<DeviceCapability, 'check'>;
  /** Lazily creates/returns the memoized model (createOnDeviceModel: layers 1 and 2). */
  readonly getModel: () => Result<PromptableModel, AppError>;
  /** Optional: answer the caller with an error after this long (the queue still waits). */
  readonly timeoutMs?: number;
}

const NOT_READY: Readonly<Record<Exclude<DeviceAvailability, 'available'>, AppError>> = {
  unavailable: createAppError('OnDeviceUnavailable', {
    message: 'On-device AI is not available on this device.',
  }),
  downloadable: createAppError('OnDeviceUnavailable', {
    message: 'The on-device model is not downloaded yet; prepare it from a click first.',
  }),
  downloading: createAppError('ModelDownloading', {
    message: 'The on-device model is still downloading.',
    progress: null,
  }),
};

const OFF_DEVICE_RESULT = createAppError('PrivacyViolation', {
  message: 'An on-device-only inference did not run on this device; its result was discarded.',
});

const TIMED_OUT = createAppError('Unknown', { message: 'On-device inference timed out.' });

/**
 * Required before every call: with 'downloadable', the SDK would still call
 * `LanguageModel.create()` (ChromeAdapterImpl.isAvailable, @firebase/ai
 * dist/esm/index.esm.js l.986-997), starting a download outside a user gesture.
 */
async function requireAvailable(
  capability: Pick<DeviceCapability, 'check'>,
): Promise<Result<void, AppError>> {
  const availability = await capability.check();
  return availability === 'available' ? ok(undefined) : err(NOT_READY[availability]);
}

/**
 * LAYER 3 (post-check). Text is read only from a response that the SDK marks as
 * `InferenceSource.ON_DEVICE` (runtime value 'on_device', set by `callCloudOrDevice`,
 * l.2569-2576); anything else is discarded unread.
 */
function readOnDeviceText(response: {
  readonly inferenceSource?: InferenceSource;
  text(): string;
}): Result<OnDeviceRunOutput, AppError> {
  if (response.inferenceSource !== InferenceSource.ON_DEVICE) {
    logger.error('on-device result discarded: inference did not run on this device', {
      inferenceSource: response.inferenceSource ?? null,
    });
    return err(OFF_DEVICE_RESULT);
  }
  return ok({ text: response.text(), source: 'ON_DEVICE' });
}

/** One full attempt; never rejects (every failure becomes an AppError). */
async function attempt(
  deps: OnDevicePromptRunnerDeps,
  prompt: RawText,
): Promise<Result<OnDeviceRunOutput, AppError>> {
  try {
    const ready = await requireAvailable(deps.capability);
    if (!ready.ok) return ready;
    const model = deps.getModel();
    if (!model.ok) return model;
    const { response } = await model.value.generateContent(prompt);
    return readOnDeviceText(response);
  } catch (error) {
    return err(mapAiError(error));
  }
}

/**
 * Runs prompts on the device, one at a time through the shared queue. With a timeout,
 * the caller gets an error once it expires, but the queue is held until the underlying
 * inference really ends (it cannot be aborted), so sessions never overlap.
 */
export function createOnDevicePromptRunner(deps: OnDevicePromptRunnerDeps): PromptRunner {
  return {
    run: (prompt) =>
      new Promise((resolve) => {
        void deps.queue.enqueue(async () => {
          const work = attempt(deps, prompt);
          const { timeoutMs } = deps;
          resolve(
            timeoutMs === undefined ? work : withDeadline(work, timeoutMs, () => err(TIMED_OUT)),
          );
          await work;
        });
      }),
  };
}
