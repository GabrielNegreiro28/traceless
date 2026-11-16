import type { Clock } from '../../application/ports/Clock';
import type {
  CaseRecord,
  NewReport,
  ReportRepository,
} from '../../application/ports/ReportRepository';
import type { CaseKey } from '../../domain/case/caseKey';
import { createAppError, type AppError } from '../../shared/appError';
import { err, ok, type Result } from '../../shared/result';

const NOT_FOUND = createAppError('NotFound', { message: 'No case with this key.' });
const EXISTS = createAppError('Unknown', {
  message: 'A different case with this key already exists.',
});

/**
 * In-memory ReportRepository for tests and demo mode. Nothing leaves the tab: the demo
 * "organization" is this map, so a case sent in demo mode can be followed up in the same tab.
 */
export class FakeReportRepository implements ReportRepository {
  readonly submitted: NewReport[] = [];
  private readonly cases = new Map<CaseKey, CaseRecord>();
  private failure: AppError | null = null;
  private readonly clock: Clock;

  /** `clock` stamps `createdAt` (wall time in ms, like the server timestamp). */
  constructor(clock: Clock = { now: () => Date.now() }) {
    this.clock = clock;
  }

  /** Makes every later call fail with `error` (null restores success). */
  failWith(error: AppError | null): void {
    this.failure = error;
  }

  submit(report: NewReport): Promise<Result<void, AppError>> {
    if (this.failure !== null) return Promise.resolve(err(this.failure));
    const existing = this.cases.get(report.caseKey);
    // Idempotent like the Firestore adapter: the same text under the same key is this report.
    if (existing !== undefined) {
      return Promise.resolve(existing.sanitizedText === report.text ? ok(undefined) : err(EXISTS));
    }
    this.submitted.push(report);
    this.cases.set(report.caseKey, {
      caseKey: report.caseKey,
      sanitizedText: report.text,
      status: 'received',
      createdAt: this.clock.now(),
    });
    return Promise.resolve(ok(undefined));
  }

  getCase(caseKey: CaseKey): Promise<Result<CaseRecord, AppError>> {
    if (this.failure !== null) return Promise.resolve(err(this.failure));
    const found = this.cases.get(caseKey);
    return Promise.resolve(found === undefined ? err(NOT_FOUND) : ok(found));
  }

  /** Test/demo helper: moves a case forward, as a handler would. */
  setStatus(caseKey: CaseKey, status: CaseRecord['status']): void {
    const found = this.cases.get(caseKey);
    if (found !== undefined) this.cases.set(caseKey, { ...found, status });
  }
}
