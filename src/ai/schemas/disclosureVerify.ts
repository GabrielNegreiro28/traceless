import type { ObjectSchemaRequest } from 'firebase/ai';
import { z } from 'zod';
import { MAX_CANDIDATES } from '../../domain/detection/candidates/candidateTypes';
import {
  DISCLOSURE_SUBJECTS,
  type CandidateVerdict,
} from '../../domain/detection/candidates/verifiedFindings';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';
import { MODEL_FINDING_CATEGORIES, stripCodeFence } from './identityScan';

/**
 * Structured output of the candidate verifier (task `disclosureVerify`, Layer 3a): one item
 * per numbered candidate, `{ id, about, category }`. Ids are 1-based, as shown in the prompt.
 */

/** At most this many candidates are shown in one call (the composition caps per chunk). */
export const MAX_VERIFY_CANDIDATES = MAX_CANDIDATES;

/** Every category the verifier may answer: the seven model categories, then NONE. */
export const VERIFY_CATEGORY_LABELS = [...MODEL_FINDING_CATEGORIES, 'NONE'] as const;

const ITEM_FIELDS = ['id', 'about', 'category'];

/** JSON Schema for the Prompt API `responseConstraint`; a fresh object on every call. */
export function buildDisclosureVerifySchema(): ObjectSchemaRequest {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        maxItems: MAX_VERIFY_CANDIDATES,
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer', minimum: 1, maximum: MAX_VERIFY_CANDIDATES },
            about: { type: 'string', enum: [...DISCLOSURE_SUBJECTS] },
            category: { type: 'string', enum: [...VERIFY_CATEGORY_LABELS] },
          },
          required: [...ITEM_FIELDS],
        },
      },
    },
    required: ['items'],
  };
}

const categorySchema = z.enum([...MODEL_FINDING_CATEGORIES, 'NONE']);

function outputSchema(candidateCount: number) {
  const item = z.object({
    id: z.number().int().min(1).max(candidateCount),
    about: z.enum(DISCLOSURE_SUBJECTS),
    category: categorySchema,
  });
  return z.object({ items: z.array(item).max(MAX_VERIFY_CANDIDATES) });
}

function invalidOutput(message: string): AppError {
  return createAppError('InvalidModelOutput', { message });
}

/**
 * Validates one verifier answer for `candidateCount` candidates. The whole answer is invalid
 * (so the caller retries) on bad JSON, a bad shape, an unknown label or an id outside
 * 1..candidateCount. Verdict indexes are 0-based. Messages never contain model or report text.
 */
export function parseDisclosureVerifyOutput(
  text: string,
  candidateCount: number,
): Result<CandidateVerdict[], AppError> {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(text));
  } catch {
    return err(invalidOutput('Candidate verifier output is not valid JSON.'));
  }
  const parsed = outputSchema(candidateCount).safeParse(json);
  if (!parsed.success) return err(invalidOutput('Candidate verifier output has a bad shape.'));
  return ok(
    parsed.data.items.map((item) => ({
      index: item.id - 1,
      about: item.about,
      category: item.category,
    })),
  );
}
