import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceSource,
  type AI,
  type GenerativeModel,
} from 'firebase/ai';
import { getApps, initializeApp } from 'firebase/app';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STRATEGIES } from '../../ai/prompts/identityScan.v1';
import { toRawText } from '../../domain/text/brandedText';
import { identityScanModelSpec } from './adapters/identityScanModelSpec';
import { createDeviceCapability } from './deviceCapability';
import { createOnDeviceModel, ON_DEVICE_ONLY_BASE_URL, onDeviceModelConfig } from './modelFactory';
import { createOnDevicePromptRunner } from './onDevicePromptRunner';
import { createSerialQueue } from './serialQueue';
import { createStuckTracker } from './stuckTracker';

/**
 * SDK CONTRACT TEST: the fail-closed layers against the REAL Firebase AI Logic SDK.
 *
 * Which build: the app ships the BROWSER build of @firebase/ai
 * (`node_modules/@firebase/ai/dist/esm/index.esm.js`, the `browser` export condition that
 * Vite uses). Under Vitest, `firebase/ai` is an external dependency loaded by Node with
 * the `node` condition, i.e. `dist/index.node.mjs`, whose AIService has no
 * `chromeAdapterFactory` (verified 2026-11-13). So this file mocks `firebase/ai` with
 * the browser build, loaded by file URL (the package `exports` map forbids the deep
 * specifier). Every module below that imports `firebase/ai` (modelFactory, errorMapper,
 * the runner) gets that same browser build. Nothing is mocked inside the SDK: only the
 * environment it talks to (`fetch` and Chrome's `LanguageModel` global) is stubbed.
 */
vi.mock('firebase/ai', async () => {
  const browserBuild = '../../../node_modules/@firebase/ai/dist/esm/index.esm.js';
  return (await import(/* @vite-ignore */ browserBuild)) as Record<string, unknown>;
});

const SENTINEL = 'SECRET-REPORT';
const REPORT = toRawText(`I am the only night nurse on ward 7. ${SENTINEL}`);
const MODEL_JSON = '{"findings":[]}';
const SPEC = identityScanModelSpec(STRATEGIES.single[0]);
interface RecordedFetch {
  readonly url: string;
  readonly carriesSentinel: boolean;
}

const fetches: RecordedFetch[] = [];

/** Records every request the SDK tries to make, then fails it like a network error. */
const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = input instanceof Request ? input.url : String(input);
  const body = typeof init?.body === 'string' ? init.body : '';
  fetches.push({ url, carriesSentinel: body.includes(SENTINEL) || url.includes(SENTINEL) });
  return Promise.reject(new TypeError('network blocked by the SDK contract test'));
});

/**
 * A fresh Firebase app and AI service per test: getAI() returns the same instance for the
 * same app, and createOnDeviceModel memoizes per AI instance, so a shared app would reuse
 * a model whose adapter captured an earlier test's LanguageModel stub.
 * Dummy config, no App Check, no Auth: nothing here can reach a real project.
 */
function freshAi(): AI {
  const name = `sdk-contract-${String(getApps().length)}`;
  const app = initializeApp({ apiKey: 'k', projectId: 'p', appId: '1:0:web:0' }, name);
  return getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true });
}

function fakePromptApi(availability: () => Promise<string>) {
  const session = { prompt: vi.fn(() => Promise.resolve(MODEL_JSON)), destroy: vi.fn() };
  const languageModel = {
    availability: vi.fn(availability),
    create: vi.fn(() => Promise.resolve(session)),
  };
  vi.stubGlobal('LanguageModel', languageModel);
  return { languageModel, session };
}

/** Runs an SDK call that is expected to fail; returns whether it settled successfully. */
async function settles(call: () => Promise<unknown>): Promise<boolean> {
  try {
    await call();
    return true;
  } catch {
    return false;
  }
}

function onlyDeadEndpointWasHit(): void {
  // Guard against a vacuous pass: the SDK must actually have attempted a request.
  expect(fetches.length).toBeGreaterThan(0);
  for (const request of fetches) {
    expect(request.url.startsWith(`${ON_DEVICE_ONLY_BASE_URL}/`)).toBe(true);
    expect(request.url).not.toContain('googleapis.com');
  }
}

describe('SDK contract: fail-closed on-device layers vs the real @firebase/ai browser build', () => {
  let ai: AI;

  beforeEach(() => {
    fetches.length = 0;
    vi.stubGlobal('fetch', fetchSpy);
    ai = freshAi();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the browser build (its AI service can build a Chrome adapter)', () => {
    // Reads an SDK-internal field on purpose: it is exactly what tells the builds apart.
    expect(typeof Reflect.get(ai, 'chromeAdapterFactory')).toBe('function');
  });

  describe('(a) Prompt API available', () => {
    it('our model runs on the device and makes zero network requests', async () => {
      const { languageModel, session } = fakePromptApi(() => Promise.resolve('available'));
      const model = createOnDeviceModel(ai, SPEC);
      if (!model.ok) throw new Error('expected a model');

      const { response } = await model.value.generateContent(REPORT);

      expect(response.inferenceSource).toBe('on_device');
      expect(response.inferenceSource).toBe(InferenceSource.ON_DEVICE);
      expect(response.text()).toBe(MODEL_JSON);
      expect(JSON.stringify(session.prompt.mock.calls)).toContain(SENTINEL);
      expect(languageModel.create).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('the full runner (all three layers) returns the on-device text with zero requests', async () => {
      fakePromptApi(() => Promise.resolve('available'));
      const runner = createOnDevicePromptRunner({
        queue: createSerialQueue(),
        stuck: createStuckTracker(),
        capability: createDeviceCapability(),
        getModel: () => createOnDeviceModel(ai, SPEC),
      });

      await expect(runner.run(REPORT)).resolves.toEqual({
        ok: true,
        value: { text: MODEL_JSON, source: 'ON_DEVICE' },
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('(b) no Prompt API, layer 1 bypassed on purpose: layer 2 alone', () => {
    let rawModel: GenerativeModel;

    beforeEach(() => {
      expect('LanguageModel' in globalThis).toBe(false);
      // Exactly what createOnDeviceModel would pass, minus its LanguageModel guard.
      const { params, requestOptions } = onDeviceModelConfig(SPEC);
      rawModel = getGenerativeModel(ai, params, requestOptions);
    });

    // firebase 13.3.0 really does attempt these cloud requests, report text included
    // (design §0); the dead baseUrl is what makes them undeliverable.
    it('generateContent never reaches a Google host', async () => {
      expect(await settles(() => rawModel.generateContent(REPORT))).toBe(false);
      onlyDeadEndpointWasHit();
    });

    it('generateContentStream never reaches a Google host', async () => {
      const ok = await settles(async () => {
        const { stream } = await rawModel.generateContentStream(REPORT);
        for await (const chunk of stream) expect(chunk).toBeUndefined();
      });
      expect(ok).toBe(false);
      onlyDeadEndpointWasHit();
    });

    it('countTokens never reaches a Google host', async () => {
      expect(await settles(() => rawModel.countTokens(REPORT))).toBe(false);
      onlyDeadEndpointWasHit();
    });

    it('a per-call baseUrl override WOULD reach Google: why OnDeviceModel takes no options', async () => {
      await settles(() =>
        rawModel.generateContent(REPORT, { baseUrl: 'https://firebasevertexai.googleapis.com' }),
      );
      expect(fetches.some((r) => r.url.includes('googleapis.com') && r.carriesSentinel)).toBe(true);
    });

    it('our factory refuses to build the model at all (layer 1)', () => {
      const model = createOnDeviceModel(ai, SPEC);
      expect(!model.ok && model.error.kind).toBe('OnDeviceUnavailable');
    });
  });

  describe('(c) Prompt API present but not usable: zero network requests', () => {
    it.each([
      ['availability() throws', () => Promise.reject(new DOMException('no', 'NotSupportedError'))],
      ["availability() is 'unavailable'", () => Promise.resolve('unavailable')],
    ])('%s: the SDK call fails without any request', async (_, availability) => {
      const { languageModel } = fakePromptApi(availability);
      const model = createOnDeviceModel(ai, SPEC);
      if (!model.ok) throw new Error('expected a model');

      expect(await settles(() => model.value.generateContent(REPORT))).toBe(false);
      expect(languageModel.create).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['throws', () => Promise.reject(new DOMException('no', 'NotSupportedError'))],
      ['unavailable', () => Promise.resolve('unavailable')],
      ['downloadable', () => Promise.resolve('downloadable')],
    ])(
      'availability %s: the runner fails before any session or request',
      async (_, availability) => {
        const { languageModel } = fakePromptApi(availability);
        const runner = createOnDevicePromptRunner({
          queue: createSerialQueue(),
          stuck: createStuckTracker(),
          capability: createDeviceCapability(),
          getModel: () => createOnDeviceModel(ai, SPEC),
        });

        const result = await runner.run(REPORT);
        expect(!result.ok && result.error.kind).toBe('OnDeviceUnavailable');
        // With 'downloadable' the SDK alone would call create() (a download outside a click).
        expect(languageModel.create).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
      },
    );
  });
});
