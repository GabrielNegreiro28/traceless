import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { getApps, initializeApp } from 'firebase/app';
import { STRATEGIES } from '../../ai/prompts/identityScan.v1';
import { DEFAULT_PROMPT_MODULE } from '../../ai/prompts/promptRegistry';
import { toRawText } from '../../domain/text/brandedText';
import { identityScanModelSpec } from './adapters/identityScanModelSpec';

/**
 * Fixtures shared by the SDK contract tests. Each test file must mock `firebase/ai` with the
 * BROWSER build itself (vi.mock is per file); see sdkContract.test.ts for why.
 */

export const SENTINEL = 'SECRET-REPORT';
export const REPORT = toRawText(`I am the only night nurse on ward 7. ${SENTINEL}`);
export const MODEL_JSON = '{"findings":[]}';
export const SPEC = identityScanModelSpec(STRATEGIES.single[0], DEFAULT_PROMPT_MODULE);

/**
 * A fresh Firebase app and AI service per test: getAI() returns the same instance for the
 * same app, and createOnDeviceModel memoizes per AI instance, so a shared app would reuse
 * a model whose adapter captured an earlier test's LanguageModel stub.
 * Dummy config, no App Check, no Auth: nothing here can reach a real project.
 */
export function freshAi(): AI {
  const name = `sdk-contract-${String(getApps().length)}`;
  const app = initializeApp({ apiKey: 'k', projectId: 'p', appId: '1:0:web:0' }, name);
  return getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true });
}
