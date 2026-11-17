import type { DisclosureCandidateFinder } from '../application/ports/DisclosureCandidates';
import { createAppError } from '../shared/appError';
import { err } from '../shared/result';

/** Loads the Layer-2 module (and its compromise tagger). Replaceable in tests. */
export type FinderLoader = () => Promise<DisclosureCandidateFinder>;

const loadCompromiseFinder: FinderLoader = async () => {
  const { CompromiseCandidateFinder } = await import('../infrastructure/nlp/compromiseCandidates');
  return new CompromiseCandidateFinder();
};

/** The finder plus an early, best-effort load (so a later offline scan still has the module). */
export interface LazyCandidateFinder extends DisclosureCandidateFinder {
  readonly preload: () => void;
}

/**
 * Part of the composition root: the Layer-2 candidate finder, loaded on its first use only (a
 * dynamic import), so pipelines without the verify pass never download it. A failed load is
 * forgotten (the next scan tries again) and answers an error, which the verify pass treats as
 * "no candidates".
 */
export function createLazyCandidateFinder(
  load: FinderLoader = loadCompromiseFinder,
): LazyCandidateFinder {
  let finder: Promise<DisclosureCandidateFinder> | null = null;
  const start = (): Promise<DisclosureCandidateFinder> => {
    const loading = (finder ??= load());
    // A failed load is forgotten so the next call retries; the rejection itself is handled here.
    loading.catch(() => {
      if (finder === loading) finder = null;
    });
    return loading;
  };
  return {
    preload() {
      void start().catch(() => undefined);
    },
    async find(text) {
      try {
        return await (await start()).find(text);
      } catch (cause) {
        return err(
          createAppError('Unknown', { message: 'The text analyser did not load.', cause }),
        );
      }
    },
  };
}
