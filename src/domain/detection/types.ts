/** Shared types for the identity-leak detection pipeline (PLANO §3.4). */

export const FINDING_CATEGORIES = [
  'ROLE_UNIQUE',
  'SCHEDULE',
  'LOCATION',
  'PERSONAL_EVENT_DATE',
  'PERSONAL_TRAIT',
  'TEAM_SIZE',
  'DIRECT_IDENTIFIER',
  'WRITING_STYLE',
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

/** UTF-16 code-unit offsets into the report text; `end` is exclusive. */
export interface TextSpan {
  readonly start: number;
  readonly end: number;
}

export type FindingOrigin = 'RULE' | 'MODEL';

/** A detail of the report that could identify the reporter. */
export interface Finding {
  readonly id: string;
  readonly span: TextSpan;
  readonly quote: string;
  readonly category: FindingCategory;
  readonly reason: string;
  readonly suggestion: string | null;
  readonly origin: FindingOrigin;
}

/** What the model adapter returns: a quote that is not yet located in the text. */
export interface ModelFinding {
  readonly quote: string;
  readonly category: FindingCategory;
  readonly reason: string;
  readonly suggestion: string | null;
}
