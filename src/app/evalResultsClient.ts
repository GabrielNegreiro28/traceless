import type { EvalRunResult } from '../application/usecases/evaluateDetection';
import { createAppError, type AppError } from '../shared/appError';
import { err, ok, type Result } from '../shared/result';

/** Dev-server endpoint registered by scripts/vite-plugin-eval-results.ts. */
const SAVE_URL = '/__eval/results';

function saveFailed(message: string): AppError {
  return createAppError('Unknown', { message });
}

/** Asks the dev server to save a result; resolves to the file name it chose. */
export async function saveEvalResult(result: EvalRunResult): Promise<Result<string, AppError>> {
  try {
    const response = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    if (!response.ok) return err(saveFailed(`The dev server answered ${response.status}.`));
    const body = (await response.json()) as { file?: unknown };
    return typeof body.file === 'string'
      ? ok(body.file)
      : err(saveFailed('The dev server sent no file name.'));
  } catch {
    return err(saveFailed('The dev server could not be reached.'));
  }
}
