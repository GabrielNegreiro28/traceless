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

/**
 * Outlet labels (docs/design/fase2-gate-iteration.md §B.1): the model may put the people
 * it must NOT flag here instead of forcing them into a category. Outlet items never
 * become findings; their quotes become protected quotes. Not domain categories.
 */
export const OUTLET_LABELS = ['REPORTED_PERSON', 'OTHER_PERSON'] as const;

export type OutletLabel = (typeof OUTLET_LABELS)[number];

/** Every label a scan item may carry: a model category or an outlet. */
export type IdentityScanLabel = ModelFindingCategory | OutletLabel;

export const MAX_MODEL_FINDINGS = 12;
/** Extra array slots when outlets are on, so protected quotes do not crowd out findings. */
export const MAX_PROTECTED_QUOTES = 8;
export const MAX_QUOTE_CHARS = 120;
export const MAX_REASON_CHARS = 200;

const FINDING_FIELDS = ['quote', 'category', 'reason', 'suggestion'];

/**
 * Structured-output schema for one identity-scan call, restricted to `categories` plus
 * the given `outlets`. Plain JSON Schema (no `nullable`/`additionalProperties`/
 * `maxLength`; lengths are clamped in code). With no outlets the output is exactly the
 * v1 schema (byte-identical, parity-tested). Returns a fresh object on every call (the
 * SDK may mutate params).
 */
export function buildIdentityScanSchema(
  categories: readonly ModelFindingCategory[],
  outlets: readonly OutletLabel[] = [],
): ObjectSchemaRequest {
  const maxItems =
    outlets.length === 0 ? MAX_MODEL_FINDINGS : MAX_MODEL_FINDINGS + MAX_PROTECTED_QUOTES;
  return {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        maxItems,
        items: {
          type: 'object',
          properties: {
            quote: { type: 'string' },
            category: { type: 'string', enum: [...categories, ...outlets] },
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

/** Zod enum of every scan label (categories, then outlets), parity-tested with the schema. */
export const scanLabelSchema = z.enum([...MODEL_FINDING_CATEGORIES, ...OUTLET_LABELS]);

const topLevelSchema = z.object({ findings: z.array(z.unknown()) });

const itemSchema = z.object({
  quote: z.string(),
  category: scanLabelSchema,
  reason: z.string(),
  suggestion: z.string(),
});

type ScanItem = z.infer<typeof itemSchema>;

/** What one identity-scan call yields once validated. */
export interface IdentityScanOutput {
  readonly findings: ModelFinding[];
  /** Quotes of outlet items (people not to flag). Raw report text: never log or persist. */
  readonly protectedQuotes: string[];
}

const FENCED = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i;

/** The JSON inside a ```json fence, or the text unchanged (shared by every model parser). */
export function stripCodeFence(text: string): string {
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

function isOutlet(label: IdentityScanLabel): label is OutletLabel {
  return (OUTLET_LABELS as readonly string[]).includes(label);
}

/** The trimmed quote, or null when it is empty or longer than 120 characters. */
function cleanQuote(quote: string): string | null {
  const trimmed = quote.trim();
  return trimmed === '' || trimmed.length > MAX_QUOTE_CHARS ? null : trimmed;
}

function toModelFinding(quote: string, item: ScanItem, category: ModelFindingCategory) {
  const suggestion = item.suggestion.trim();
  return {
    quote,
    category,
    reason: item.reason.trim().slice(0, MAX_REASON_CHARS),
    suggestion: suggestion === '' ? null : suggestion,
  } satisfies ModelFinding;
}

/**
 * Validates identity-scan model output. Invalid items are dropped one by one (wrong
 * types, unknown or disallowed label, empty or >120-char quote). Items labelled with
 * one of `outlets` become protected quotes, never findings; outlet items are dropped
 * when `outlets` is empty (v1). Findings: the reason is clamped to 200 chars, an empty
 * suggestion means "remove" (null), at most 12 are kept; at most 8 protected quotes.
 * Only bad JSON or a bad top-level shape is an InvalidModelOutput error. Error messages
 * never contain model or report text.
 */
export function parseIdentityScanOutput(
  text: string,
  allowed: readonly ModelFindingCategory[],
  outlets: readonly OutletLabel[] = [],
): Result<IdentityScanOutput, AppError> {
  const json = parseJson(text);
  if (!json.ok) return json;
  const top = topLevelSchema.safeParse(json.value);
  if (!top.success) return err(invalidOutput('Identity scan output has an unexpected shape.'));
  const findings: ModelFinding[] = [];
  const protectedQuotes: string[] = [];
  for (const raw of top.data.findings) {
    const item = itemSchema.safeParse(raw);
    const quote = item.success ? cleanQuote(item.data.quote) : null;
    if (!item.success || quote === null) continue;
    const { category } = item.data;
    if (isOutlet(category)) {
      if (outlets.includes(category)) protectedQuotes.push(quote);
    } else if (allowed.includes(category)) {
      findings.push(toModelFinding(quote, item.data, category));
    }
  }
  return ok({
    findings: findings.slice(0, MAX_MODEL_FINDINGS),
    protectedQuotes: protectedQuotes.slice(0, MAX_PROTECTED_QUOTES),
  });
}
