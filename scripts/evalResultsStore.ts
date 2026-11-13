import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Largest accepted result body (a full evaluation is well under 1 MB). */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Only plain label characters may reach the file name (no path separators). */
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface ResultMeta {
  readonly promptVersion: string;
  readonly strategy: string;
  readonly split: string;
}

export interface SaveOutcome {
  readonly status: number;
  readonly body: { readonly file?: string; readonly error?: string };
}

function isLabel(value: unknown): value is string {
  return typeof value === 'string' && LABEL.test(value);
}

/** Checks the JSON text is an object carrying safe promptVersion/strategy/split labels. */
export function parseResultMeta(text: string): ResultMeta | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const { promptVersion, strategy, split } = parsed as Record<string, unknown>;
  if (!isLabel(promptVersion) || !isLabel(strategy) || !isLabel(split)) return null;
  return { promptVersion, strategy, split };
}

/** Server-chosen name; ':' is replaced so the name is valid on Windows. */
export function resultFileName(meta: ResultMeta, now: Date): string {
  const stamp = now.toISOString().replaceAll(':', '-');
  return `${meta.promptVersion}-${meta.strategy}-${meta.split}-${stamp}.json`;
}

function failure(status: number, error: string): SaveOutcome {
  return { status, body: { error } };
}

function isExistsError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'EEXIST';
}

/** Validates and writes one result file; never overwrites (flag 'wx'). */
export async function saveEvalResult(text: string, dir: string, now: Date): Promise<SaveOutcome> {
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return failure(413, 'Body too large.');
  const meta = parseResultMeta(text);
  if (meta === null) return failure(400, 'Body must be a JSON result object.');
  const file = resultFileName(meta, now);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, file), text, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    return isExistsError(error)
      ? failure(409, 'File already exists.')
      : failure(500, 'Write failed.');
  }
  return { status: 201, body: { file } };
}
