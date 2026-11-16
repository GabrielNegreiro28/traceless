import type { ObjectSchemaRequest } from 'firebase/ai';
import { z } from 'zod';
import {
  MAX_DETAIL_CHARS,
  MAX_SUMMARY_CHARS,
  REPORT_CATEGORIES,
  type StructuredReport,
} from '../../domain/report/structuredReport';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';

const FIELDS = ['category', 'summary', 'when', 'where'];

/**
 * Structured-output schema for one structureReport call, used both as the Prompt API
 * `responseConstraint` (on-device) and the Gemini `responseSchema` (cloud). Plain JSON Schema
 * (no `nullable`/`maxLength`): "" means "not stated" and lengths are clamped in code. A fresh
 * object on every call (the SDK may mutate params).
 */
export function buildStructureReportSchema(): ObjectSchemaRequest {
  return {
    type: 'object',
    properties: {
      category: { type: 'string', enum: [...REPORT_CATEGORIES] },
      summary: { type: 'string' },
      when: { type: 'string' },
      where: { type: 'string' },
    },
    required: [...FIELDS],
  };
}

const OUTPUT = z.object({
  category: z.enum(REPORT_CATEGORIES),
  summary: z.string(),
  when: z.string(),
  where: z.string(),
});

const INVALID = createAppError('InvalidModelOutput', {
  message: 'The structureReport output did not match its schema.',
});

/** Cuts at `max` characters on a word boundary when possible, with an ellipsis. */
export function clampText(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function detailOrNull(value: string): string | null {
  const text = clampText(value, MAX_DETAIL_CHARS);
  return text === '' ? null : text;
}

/** Validates one model answer (JSON text). Messages never echo the output. */
export function parseStructuredReport(text: string): Result<StructuredReport, AppError> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(INVALID);
  }
  const parsed = OUTPUT.safeParse(json);
  if (!parsed.success) return err(INVALID);
  const summary = clampText(parsed.data.summary, MAX_SUMMARY_CHARS);
  if (summary === '') return err(INVALID);
  return ok({
    category: parsed.data.category,
    summary,
    when: detailOrNull(parsed.data.when),
    where: detailOrNull(parsed.data.where),
  });
}
