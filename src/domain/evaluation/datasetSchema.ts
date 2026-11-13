import { z } from 'zod';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import type { FindingCategory } from '../detection/types';

/** Categories the model may emit (WRITING_STYLE belongs to the style neutraliser). */
export const GOLD_CATEGORIES = [
  'ROLE_UNIQUE',
  'SCHEDULE',
  'LOCATION',
  'PERSONAL_EVENT_DATE',
  'PERSONAL_TRAIT',
  'TEAM_SIZE',
  'DIRECT_IDENTIFIER',
] as const satisfies readonly FindingCategory[];

export const MUST_NOT_KINDS = ['ACCUSED', 'INCIDENT_FACT', 'OTHER_PERSON'] as const;
export type MustNotKind = (typeof MUST_NOT_KINDS)[number];

export const SPLITS = ['dev', 'test'] as const;
export type Split = (typeof SPLITS)[number];

const occurrenceSchema = z.number().int().min(1).optional();

const goldSchema = z.object({
  quote: z.string().min(1),
  category: z.enum(GOLD_CATEGORIES),
  /** 1-based; needed when the quote appears more than once. */
  occurrence: occurrenceSchema,
});

const mustNotSchema = z.object({
  quote: z.string().min(1),
  kind: z.enum(MUST_NOT_KINDS),
  occurrence: occurrenceSchema,
});

const reportSchema = z.object({
  id: z.string().min(1),
  sector: z.string().min(1),
  split: z.enum(SPLITS),
  text: z.string().min(1),
  gold: z.array(goldSchema),
  mustNotFlag: z.array(mustNotSchema),
});

export const datasetSchema = z.object({
  version: z.string().min(1),
  reports: z.array(reportSchema),
});

export type GoldAnnotation = z.infer<typeof goldSchema>;
export type MustNotAnnotation = z.infer<typeof mustNotSchema>;
export type DatasetReport = z.infer<typeof reportSchema>;
export type Dataset = z.infer<typeof datasetSchema>;

/** Validates the dataset JSON shape. Error lists issue paths only, never values. */
export function parseDataset(json: unknown): Result<Dataset, AppError> {
  const parsed = datasetSchema.safeParse(json);
  if (parsed.success) return ok(parsed.data);
  const paths = parsed.error.issues.map((issue) => issue.path.join('.') || '(root)');
  return err(
    createAppError('Misconfigured', {
      message: 'The evaluation dataset does not match its schema.',
      missing: paths,
    }),
  );
}
