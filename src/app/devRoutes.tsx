import type { RouteObject } from 'react-router';

/**
 * Developer-only routes. `import.meta.env.DEV` is a literal `false` in production
 * builds, so the bundler folds the conditional and drops the dynamic import (and the
 * whole evaluation chunk with it). Guarded by scripts/verify-no-eval-in-dist.mjs.
 */
export const devRoutes: readonly RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/eval',
        lazy: async () => ({ Component: (await import('./EvalRoute')).default }),
      },
    ]
  : [];
