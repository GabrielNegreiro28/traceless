import type { InferenceSourceKind } from '../../application/ports/IdentityScanner';
import type { ReportStructurer, StructureOutcome } from '../../application/ports/ReportStructurer';
import {
  MAX_SUMMARY_CHARS,
  type ReportCategory,
  type StructuredReport,
} from '../../domain/report/structuredReport';
import type { SanitizedText } from '../../domain/text/brandedText';
import type { AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';

export interface FakeReportStructurerOptions {
  /** A fixed answer instead of the keyword heuristic. */
  readonly report?: StructuredReport;
  /** Makes every call fail with this error. */
  readonly error?: AppError;
  /** Where the fake claims to have run (default ON_DEVICE; demo mode never shows it as AI). */
  readonly source?: InferenceSourceKind;
}

const KEYWORDS: readonly (readonly [ReportCategory, RegExp])[] = [
  ['retaliation', /retaliat|punish|demot|fired me/i],
  ['harassment', /harass|bull(y|ied)|threat|intimidat/i],
  ['discrimination', /discriminat|racis|sexis/i],
  ['fraud', /fraud|invoice|brib|embezzl|kickback|shell company/i],
  ['safety', /safety|unsafe|danger|injur|fire|hazard/i],
];

function firstSentence(text: string): string {
  const sentence = (text.trim().split(/(?<=[.!?])\s/)[0] ?? '').replace(/\s+/g, ' ');
  return sentence.length <= MAX_SUMMARY_CHARS
    ? sentence
    : `${sentence.slice(0, MAX_SUMMARY_CHARS - 1)}…`;
}

/** Deterministic stand-in: a keyword category and the first sentence; no when/where. */
export function heuristicStructure(text: string): StructuredReport {
  const category = KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other';
  return { category, summary: firstSentence(text), when: null, where: null };
}

/**
 * Deterministic ReportStructurer for tests, E2E and demo mode. Records the texts it receives
 * (in memory only). No Firebase, no network, no timers.
 */
export class FakeReportStructurer implements ReportStructurer {
  readonly texts: SanitizedText[] = [];
  private readonly options: FakeReportStructurerOptions;

  constructor(options: FakeReportStructurerOptions = {}) {
    this.options = options;
  }

  async structure(text: SanitizedText): Promise<Result<StructureOutcome, AppError>> {
    this.texts.push(text);
    await Promise.resolve();
    if (this.options.error !== undefined) return err(this.options.error);
    const report = this.options.report ?? heuristicStructure(text);
    return ok({ report, source: this.options.source ?? 'ON_DEVICE' });
  }
}
