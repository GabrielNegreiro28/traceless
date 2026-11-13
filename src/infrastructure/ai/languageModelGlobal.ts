import type { LanguageModelExpected } from 'firebase/ai';

/**
 * Chrome's Prompt API global (`LanguageModel`). TypeScript's DOM lib has no typings
 * for it, so this declares only the part the app calls directly.
 */
export interface LanguageModelGlobal {
  availability(options: OnDeviceTextOptions): Promise<unknown>;
}

export interface OnDeviceTextOptions {
  expectedInputs: LanguageModelExpected[];
  expectedOutputs: LanguageModelExpected[];
}

/**
 * Text-only English input and output: the only language the app sends on-device
 * (CLAUDE.md rule 4). Chrome warns about quality/safety when the output language is
 * missing. Fresh arrays on every call, because the SDK keeps (and may fill in) the
 * option objects it is given (ChromeAdapterImpl constructor, @firebase/ai
 * dist/esm/index.esm.js l.925-954).
 */
export function onDeviceTextOptions(): OnDeviceTextOptions {
  return {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  };
}

function isLanguageModelGlobal(value: unknown): value is LanguageModelGlobal {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  return typeof Reflect.get(value, 'availability') === 'function';
}

/**
 * The Prompt API global, or undefined when this browser does not expose a usable one.
 * Synchronous on purpose: the model factory calls it right before creating a model.
 * In a browser `globalThis === window`, which is where the SDK looks
 * (`chromeAdapterFactory`, l.1224-1231, called from `getGenerativeModel`, l.4889).
 */
export function readLanguageModel(
  globalObject: object = globalThis,
): LanguageModelGlobal | undefined {
  if (!('LanguageModel' in globalObject)) return undefined;
  const value: unknown = Reflect.get(globalObject, 'LanguageModel');
  return isLanguageModelGlobal(value) ? value : undefined;
}
