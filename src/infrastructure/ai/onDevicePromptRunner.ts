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
import type { StuckTracker } from './stuckTracker';

/**
 * The slice of the model the runner uses (`OnDeviceModel` from modelFactory satisfies it).
 * One argument only: per-call request options are never passed.
 */
export interface PromptableModel {
  generateContent(prompt: string): Promise<{
    readonly response: { readonly inferenceSource?: InferenceSource; text(): string };
  }>;
  /** Aborts the model's session and forgets it (see `OnDeviceModel.abandon`). */
  abandon(): void;
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
  /**
   * The ONE stuck tracker shared by every runner on that queue (see stuckTracker.ts); it
   * also holds the page load's recovery budget.
   */
  readonly stuck: StuckTracker;
  readonly capability: Pick<DeviceCapability, 'check'>;
  /** Lazily creates/returns the memoized model (createOnDeviceModel: layers 1 and 2). */
  readonly getModel: () => Result<PromptableModel, AppError>;
  /**
   * Optional: answer the caller with `OnDeviceStuck` after this long. The stalled model is
   * abandoned; the queue still waits for the inference, and later calls fail fast until it
   * ends (for good once a stall is terminal).
   */
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

type RunResult = Result<OnDeviceRunOutput, AppError>;

/** Fixed: the deadline expired, the model was abandoned and the work settled (§G.2). */
const STUCK_RECOVERABLE = createAppError('OnDeviceStuck', {
  message: 'On-device AI stalled; its model was abandoned and the next call starts a fresh one.',
  recoverable: true,
});

/**
 * Fixed: a stall this page load cannot recover from (recoveries spent, or the abandoned work
 * never settled), or a call made while a timed-out inference still runs.
 */
const STUCK_TERMINAL = createAppError('OnDeviceStuck', {
  message: 'On-device AI is not responding. Reload the page to try again.',
  recoverable: false,
});

/** The model an attempt is using, so that a deadline abandons exactly that one. */
interface InFlight {
  model: PromptableModel | null;
}

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
  inFlight: InFlight,
): Promise<Result<OnDeviceRunOutput, AppError>> {
  try {
    const ready = await requireAvailable(deps.capability);
    if (!ready.ok) return ready;
    const model = deps.getModel();
    if (!model.ok) return model;
    inFlight.model = model.value;
    const { response } = await model.value.generateContent(prompt);
    return readOnDeviceText(response);
  } catch (error) {
    return err(mapAiError(error));
  }
}

/**
 * Stuck recovery (docs/design/fase2-gate-iteration.md §G.2), after the deadline expired:
 * the still-running inference marks the tracker stuck until it settles, its model is
 * abandoned (the abort destroys the Chrome session, so the hung prompt rejects), and the
 * tracker decides whether the caller may try again. Nothing is retried here.
 */
async function recoverFromStall(
  stuck: StuckTracker,
  work: Promise<RunResult>,
  inFlight: InFlight,
): Promise<RunResult> {
  stuck.holdUntilSettled(work);
  inFlight.model?.abandon();
  logger.warn('on-device inference timed out; its model was abandoned');
  const recoverable = await stuck.recover(work);
  if (!recoverable) logger.warn('on-device stall is terminal for this page load');
  return err(recoverable ? STUCK_RECOVERABLE : STUCK_TERMINAL);
}

/** Answers the caller with `work`, or with `OnDeviceStuck` once the deadline expires. */
async function answerWithin(
  deps: OnDevicePromptRunnerDeps,
  work: Promise<RunResult>,
  inFlight: InFlight,
): Promise<RunResult> {
  const { timeoutMs } = deps;
  if (timeoutMs === undefined) return work;
  const answer = await withDeadline<RunResult | null>(work, timeoutMs, () => null);
  return answer ?? recoverFromStall(deps.stuck, work, inFlight);
}

/**
 * Runs prompts on the device, one at a time through the shared queue. With a timeout,
 * the caller gets `OnDeviceStuck` once it expires and the stalled model is abandoned, but
 * the queue is held until the underlying inference really ends, so sessions never overlap;
 * meanwhile new calls fail fast with a terminal `OnDeviceStuck` instead of waiting behind it.
 * (A call already queued when the deadline fires still waits; the app scans one chunk
 * at a time, so nothing is queued behind a running inference in practice.)
 */
export function createOnDevicePromptRunner(deps: OnDevicePromptRunnerDeps): PromptRunner {
  return {
    run: (prompt) => {
      if (deps.stuck.isStuck()) return Promise.resolve(err(STUCK_TERMINAL));
      return new Promise((resolve) => {
        void deps.queue.enqueue(async () => {
          const inFlight: InFlight = { model: null };
          const work = attempt(deps, prompt, inFlight);
          resolve(answerWithin(deps, work, inFlight));
          await work;
        });
      });
    },
  };
}
