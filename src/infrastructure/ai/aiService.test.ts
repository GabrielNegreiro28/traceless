import type { FirebaseApp } from 'firebase/app';
import { GoogleAIBackend } from 'firebase/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAiService } from './aiService';

const sdk = vi.hoisted(() => ({ getAI: vi.fn() }));

vi.mock('firebase/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAI: sdk.getAI,
}));

function fakeApp(name: string): FirebaseApp {
  return { name } as unknown as FirebaseApp;
}

describe('getAiService', () => {
  beforeEach(() => {
    sdk.getAI.mockImplementation((app: FirebaseApp) => ({ app }));
  });

  it('uses the Gemini Developer API backend with limited-use App Check tokens', () => {
    const app = fakeApp('a');
    getAiService(app);
    expect(sdk.getAI).toHaveBeenCalledTimes(1);
    expect(sdk.getAI).toHaveBeenCalledWith(app, {
      backend: expect.any(GoogleAIBackend) as unknown,
      useLimitedUseAppCheckTokens: true,
    });
  });

  it('creates the service once per app and reuses it', () => {
    const app = fakeApp('b');
    const first = getAiService(app);
    expect(getAiService(app)).toBe(first);
    expect(sdk.getAI).toHaveBeenCalledTimes(1);
    expect(getAiService(fakeApp('c'))).not.toBe(first);
    expect(sdk.getAI).toHaveBeenCalledTimes(2);
  });
});
