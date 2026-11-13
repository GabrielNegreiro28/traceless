import type { AI, LanguageModelCreateOptions } from 'firebase/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeviceCapability } from './deviceCapability';
import { createOnDeviceModel } from './modelFactory';
import { createOnDevicePromptRunner } from './onDevicePromptRunner';
import { freshAi, MODEL_JSON, REPORT, SPEC } from './sdkContract.testKit';
import { createSerialQueue } from './serialQueue';
import { createStuckTracker } from './stuckTracker';

/**
 * SDK CONTRACT TEST, stuck recovery (docs/design/fase2-gate-iteration.md §G.2), against the
 * REAL @firebase/ai browser build (same mock as sdkContract.test.ts, which explains why).
 * Only Chrome's `LanguageModel` global and `fetch` are stubbed. The fake Prompt API follows
 * the Prompt API explainer: aborting the signal given to `create()` destroys the session,
 * which rejects its running `prompt()` with an AbortError.
 */
vi.mock('firebase/ai', async () => {
  const browserBuild = '../../../node_modules/@firebase/ai/dist/esm/index.esm.js';
  return (await import(/* @vite-ignore */ browserBuild)) as Record<string, unknown>;
});

const TIMEOUT_MS = 50;

/** The first session hangs until its create() signal aborts; later sessions answer at once. */
function hangingThenHealthyPromptApi() {
  let sessions = 0;
  const create = vi.fn((options?: LanguageModelCreateOptions) => {
    sessions += 1;
    const hang = sessions === 1;
    const prompt = vi.fn(() => {
      if (!hang) return Promise.resolve(MODEL_JSON);
      return new Promise<string>((_, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The session was destroyed.', 'AbortError'));
        });
      });
    });
    return Promise.resolve({ prompt, destroy: vi.fn() });
  });
  const languageModel = { availability: vi.fn(() => Promise.resolve('available')), create };
  vi.stubGlobal('LanguageModel', languageModel);
  return languageModel;
}

describe('SDK contract: a stalled on-device call recovers on a fresh model', () => {
  let ai: AI;
  const fetchSpy = vi.fn(() => Promise.reject(new TypeError('network blocked')));

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    ai = freshAi();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('timeout aborts the session through createOptions.signal; the next run succeeds', async () => {
    const languageModel = hangingThenHealthyPromptApi();
    const getModel = vi.fn(() => createOnDeviceModel(ai, SPEC));
    const runner = createOnDevicePromptRunner({
      queue: createSerialQueue(),
      stuck: createStuckTracker(),
      capability: createDeviceCapability(),
      getModel,
      timeoutMs: TIMEOUT_MS,
    });

    const first = await runner.run(REPORT);
    expect(first).toMatchObject({ ok: false, error: { kind: 'OnDeviceStuck', recoverable: true } });

    const second = await runner.run(REPORT);
    expect(second).toEqual({ ok: true, value: { text: MODEL_JSON, source: 'ON_DEVICE' } });

    const [stalled, fresh] = languageModel.create.mock.calls.map(([options]) => options?.signal);
    expect(stalled?.aborted).toBe(true);
    expect(fresh).toBeInstanceOf(AbortSignal);
    expect(fresh).not.toBe(stalled);
    expect(fresh?.aborted).toBe(false);
    type Built = ReturnType<typeof createOnDeviceModel>;
    const [modelA, modelB] = getModel.mock.results.map((r) => r.value as Built);
    expect(modelA?.ok && modelB?.ok && modelA.value !== modelB.value).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
