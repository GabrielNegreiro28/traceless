import type { ObjectSchemaRequest } from 'firebase/ai';
import { z } from 'zod';
import {
  FINDING_CATEGORIES,
  type FindingCategory,
  type ModelFinding,
} from '../../domain/detection/types';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';

/** WRITING_STYLE belongs to the styleNeutralize task, never to the identity scan. */
export type ModelFindingCategory = Exclude<FindingCategory, 'WRITING_STYLE'>;

function isModelCategory(category: FindingCategory): category is ModelFindingCategory {
  return category !== 'WRITING_STYLE';
}

/** Single source for the JSON Schema enum and the zod enum (parity-tested). */
export const MODEL_FINDING_CATEGORIES: readonly ModelFindingCategory[] =
  FINDING_CATEGORIES.filter(isModelCategory);

export const MAX_MODEL_FINDINGS = 12;
export const MAX_QUOTE_CHARS = 120;
export const MAX_REASON_CHARS = 200;

const FINDING_FIELDS = ['quote', 'category', 'reason', 'suggestion'];

/**
 * Structured-output schema for one identity-scan call, restricted to `categories`.
 * Plain JSON Schema (no `nullable`/`additionalProperties`/`maxLength`; lengths are
 * clamped in code). Used as the on-device `responseConstraint` and the cloud
 * `responseSchema`. Returns a fresh object on every call (the SDK may mutate params).
 */
export function buildIdentityScanSchema(
  categories: readonly ModelFindingCategory[],
): ObjectSchemaRequest {
  return {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        maxItems: MAX_MODEL_FINDINGS,
        items: {
          type: 'object',
          properties: {
            quote: { type: 'string' },
            category: { type: 'string', enum: [...categories] },
            reason: { type: 'string' },
            suggestion: { type: 'string' },
          },
          required: [...FINDING_FIELDS],
        },
      },
    },
    required: ['findings'],
  };
}

export const modelCategorySchema = z.enum(MODEL_FINDING_CATEGORIES);

const topLevelSchema = z.object({ findings: z.array(z.unknown()) });

const itemSchema = z.object({
  quote: z.string(),
  category: modelCategorySchema,
  reason: z.string(),
  suggestion: z.string(),
});

const FENCED = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i;

function stripCodeFence(text: string): string {
  return FENCED.exec(text)?.[1] ?? text;
}

function invalidOutput(message: string): AppError {
  return createAppError('InvalidModelOutput', { message });
}

function parseJson(text: string): Result<unknown, AppError> {
  try {
    return ok(JSON.parse(stripCodeFence(text)) as unknown);
  } catch {
    return err(invalidOutput('Identity scan output is not valid JSON.'));
  }
}

/** One raw item → a ModelFinding, or null when it must be dropped. */
function salvageItem(item: unknown, allowed: readonly ModelFindingCategory[]): ModelFinding | null {
  const parsed = itemSchema.safeParse(item);
  if (!parsed.success) return null;
  const { quote, category, reason, suggestion } = parsed.data;
  const trimmedQuote = quote.trim();
  if (trimmedQuote === '' || trimmedQuote.length > MAX_QUOTE_CHARS) return null;
  if (!allowed.includes(category)) return null;
  const trimmedSuggestion = suggestion.trim();
  return {
    quote: trimmedQuote,
    category,
    reason: reason.trim().slice(0, MAX_REASON_CHARS),
    suggestion: trimmedSuggestion === '' ? null : trimmedSuggestion,
  };
}

/**
 * Validates identity-scan model output. Invalid items are dropped one by one (wrong
 * types, unknown or disallowed category, empty or >120-char quote); the reason is
 * clamped to 200 chars, an empty suggestion means "remove" (null), and at most 12 valid
 * items are kept. Only bad JSON or a bad top-level shape is an InvalidModelOutput error.
 * Error messages never contain model or report text.
 */
export function parseIdentityScanOutput(
  text: string,
  allowed: readonly ModelFindingCategory[],
): Result<ModelFinding[], AppError> {
  const json = parseJson(text);
  if (!json.ok) return json;
  const top = topLevelSchema.safeParse(json.value);
  if (!top.success) return err(invalidOutput('Identity scan output has an unexpected shape.'));
  const findings = top.data.findings
    .map((item) => salvageItem(item, allowed))
    .filter((finding): finding is ModelFinding => finding !== null);
  return ok(findings.slice(0, MAX_MODEL_FINDINGS));
}
