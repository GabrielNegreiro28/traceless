import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Largest accepted result body (a full evaluation is well under 1 MB). */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** Only plain label characters may reach the file name (no path separators; '+' is safe). */
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;

export interface ResultMeta {
  readonly promptVersion: string;
  readonly strategy: string;
  readonly split: string;
  /** From `variant.id`; names the file when present (older results have no variant). */
  readonly variantId?: string;
  /** From `datasetVersion` (e.g. reports.v1, reports.v2-test); older files may lack it. */
  readonly datasetVersion?: string;
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
  const record = parsed as Record<string, unknown>;
  const { promptVersion, strategy, split, variant, datasetVersion } = record;
  if (!isLabel(promptVersion) || !isLabel(strategy) || !isLabel(split)) return null;
  if (datasetVersion !== undefined && !isLabel(datasetVersion)) return null;
  const base = {
    promptVersion,
    strategy,
    split,
    ...(datasetVersion === undefined ? {} : { datasetVersion }),
  };
  if (variant === undefined) return base;
  const id: unknown =
    typeof variant === 'object' && variant !== null ? Reflect.get(variant, 'id') : null;
  return isLabel(id) ? { ...base, variantId: id } : null;
}

/**
 * Short dataset tag for file names: `reports.v1` -> `v1`, `reports.v2-test` -> `v2`; any
 * other version keeps its own label; none without a dataset version.
 */
export function datasetTag(datasetVersion: string | undefined): string {
  if (datasetVersion === undefined) return '';
  const short = datasetVersion.replace(/^reports\./, '');
  return short.split('-')[0] ?? short;
}

/**
 * Server-chosen name; ':' is replaced so the name is valid on Windows. The split carries the
 * dataset tag when known (`-v1all-`, `-v2test-`), so results on different datasets never mix.
 */
export function resultFileName(meta: ResultMeta, now: Date): string {
  const stamp = now.toISOString().replaceAll(':', '-');
  const name = meta.variantId ?? `${meta.promptVersion}-${meta.strategy}`;
  return `${name}-${datasetTag(meta.datasetVersion)}${meta.split}-${stamp}.json`;
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
