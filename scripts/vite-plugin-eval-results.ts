import { join } from 'node:path';
import type { Plugin } from 'vite';
import { createEvalResultsHandler, EVAL_RESULTS_ROUTE } from './evalResultsHandler.ts';

/**
 * Dev-server only (`apply: 'serve'`): saves evaluation results under eval/results/ of the
 * project root. The file name is chosen server-side and existing files are never replaced.
 */
export function evalResultsPlugin(): Plugin {
  return {
    name: 'traceless-eval-results',
    apply: 'serve',
    configureServer(server) {
      const resultsDir = join(server.config.root, 'eval', 'results');
      server.middlewares.use(EVAL_RESULTS_ROUTE, createEvalResultsHandler({ resultsDir }));
    },
  };
}
