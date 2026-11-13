import { InferenceSource } from 'firebase/ai';
import { vi } from 'vitest';
import type { DeviceAvailability } from '../../application/ports/DeviceCapability';
import { toRawText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { ok, type Result } from '../../shared/result';
import {
  createOnDevicePromptRunner,
  type OnDevicePromptRunnerDeps,
  type PromptableModel,
} from './onDevicePromptRunner';
import { createSerialQueue } from './serialQueue';
import { createStuckTracker, type StuckTracker } from './stuckTracker';

/** Shared fakes for the on-device runner tests (synthetic text only). */

export const PROMPT = toRawText('Report:\n"""\nI am the only night nurse.\n"""');
export const MODEL_TEXT = '{"findings":[]}';

export interface Answer {
  readonly source?: InferenceSource | undefined;
  readonly text?: string;
  readonly gate?: Promise<void>;
  readonly error?: Error;
}

export interface FakeModelOptions {
  /**
   * Emulates Chrome: aborting the create() signal destroys the session, which rejects the
   * running prompt with an AbortError. Without it, an abandoned call keeps hanging.
   */
  readonly abortSettles?: boolean;
}

export type FakeModel = ReturnType<typeof fakeModel>;

/**
 * Scripted model with a start/end log; `text()` is a spy so tests can prove it was never
 * read, and `abandon()` is a spy (optionally rejecting the call in flight).
 */
export function fakeModel(answers: readonly Answer[], options: FakeModelOptions = {}) {
  const events: string[] = [];
  const prompts: string[] = [];
  const text = vi.fn((value: string) => value);
  let rejectInFlight: () => void = () => undefined;
  const abandon = vi.fn(() => {
    if (options.abortSettles === true) rejectInFlight();
  });
  const model: PromptableModel = {
    async generateContent(prompt) {
      const index = prompts.length;
      prompts.push(prompt);
      events.push(`start:${index}`);
      const answer = answers[index] ?? {};
      const aborted = new Promise<never>((_, reject) => {
        rejectInFlight = () => reject(new DOMException('session destroyed', 'AbortError'));
      });
      await Promise.race([answer.gate ?? Promise.resolve(), aborted]);
      events.push(`end:${index}`);
      if (answer.error !== undefined) throw answer.error;
      const source = 'source' in answer ? answer.source : InferenceSource.ON_DEVICE;
      const readText = () => text(answer.text ?? MODEL_TEXT);
      return {
        response:
          source === undefined ? { text: readText } : { inferenceSource: source, text: readText },
      };
    },
    abandon,
  };
  return { model, events, prompts, text, abandon };
}

/**
 * Emulates modelFactory's memo: one model at a time, built on demand from the next answer
 * script; `abandon()` forgets it, so the next getModel() builds a NEW model.
 */
export function memoizedModels(
  scripts: readonly (readonly Answer[])[],
  options?: FakeModelOptions,
) {
  const built: FakeModel[] = [];
  let current: FakeModel | null = null;
  const getModel = (): Result<PromptableModel, AppError> => {
    if (current === null) {
      const fake = fakeModel(scripts[built.length] ?? [], options);
      const forget = fake.abandon.getMockImplementation() ?? (() => undefined);
      fake.abandon.mockImplementation(() => {
        forget();
        if (current === fake) current = null;
      });
      built.push(fake);
      current = fake;
    }
    return ok(current.model);
  };
  return { getModel, built };
}

export function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export interface SetupOptions {
  readonly availability?: DeviceAvailability;
  readonly getModel?: () => Result<PromptableModel, AppError>;
  readonly stuck?: StuckTracker;
}

export function setup(model: PromptableModel, options: SetupOptions = {}, timeoutMs?: number) {
  const check = vi.fn(() => Promise.resolve(options.availability ?? 'available'));
  const getModel = vi.fn(options.getModel ?? (() => ok(model)));
  const deps: OnDevicePromptRunnerDeps = {
    queue: createSerialQueue(),
    stuck: options.stuck ?? createStuckTracker(),
    capability: { check },
    getModel,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
  return { runner: createOnDevicePromptRunner(deps), check, getModel };
}
