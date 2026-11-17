import type { DisclosureCandidateFinder } from '../application/ports/DisclosureCandidates';
import { createAppError } from '../shared/appError';
import { err } from '../shared/result';

/** Loads the Layer-2 module (and its compromise tagger). Replaceable in tests. */
export type FinderLoader = () => Promise<DisclosureCandidateFinder>;

const loadCompromiseFinder: FinderLoader = async () => {
  const { CompromiseCandidateFinder } = await import('../infrastructure/nlp/compromiseCandidates');
  return new CompromiseCandidateFinder();
};

/**
 * Part of the composition root: the Layer-2 candidate finder, loaded on its first use only (a
 * dynamic import), so pipelines without the verify pass never download it. A failed load is
 * forgotten (the next scan tries again) and answers an error, which the verify pass treats as
 * "no candidates".
 */
export function createLazyCandidateFinder(
  load: FinderLoader = loadCompromiseFinder,
): DisclosureCandidateFinder {
  let finder: Promise<DisclosureCandidateFinder> | null = null;
  return {
    async find(text) {
      try {
        finder ??= load();
        return await (await finder).find(text);
      } catch (cause) {
        finder = null;
        return err(
          createAppError('Unknown', { message: 'The text analyser did not load.', cause }),
        );
      }
    },
  };
}
