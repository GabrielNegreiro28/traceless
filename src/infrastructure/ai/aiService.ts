import type { FirebaseApp } from 'firebase/app';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';

const services = new WeakMap<FirebaseApp, AI>();

/**
 * The single Firebase AI Logic service for an app (Gemini Developer API backend).
 *
 * `useLimitedUseAppCheckTokens: true` makes every cloud request carry a fresh
 * limited-use App Check token (`getLimitedUseToken`, @firebase/ai dist/esm/index.esm.js
 * l.1345-1347), which enables replay protection. The SDK fixes this option on the
 * first `getAI()` call for an app and backend and throws on a conflicting later call
 * (l.4829-4846), so the instance is created once here and reused.
 */
export function getAiService(app: FirebaseApp): AI {
  const existing = services.get(app);
  if (existing !== undefined) return existing;
  const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true });
  services.set(app, ai);
  return ai;
}
