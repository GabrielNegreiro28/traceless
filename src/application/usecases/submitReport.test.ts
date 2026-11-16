import { assertType, beforeEach, describe, expect, it } from 'vitest';
import { generateCaseKey } from '../../domain/case/caseKey';
import { MAX_SUBMITTED_CHARS } from '../../domain/case/caseStatus';
import type { ConsentedRawText, RawText, SanitizedText } from '../../domain/text/brandedText';
import { FakeAuthService } from '../../infrastructure/fakes/FakeAuthService';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeReportRepository } from '../../infrastructure/fakes/FakeReportRepository';
import { createAppError } from '../../shared/appError';
import type { NewReport, ReportRepository } from '../ports/ReportRepository';
import { submitReport, type SubmitReportDeps } from './submitReport';
import { approvedText, seededBytes } from './submitReport.testKit';

const TEXT = approvedText('A manager approved invoices from a shell company.');
const KEY = generateCaseKey(seededBytes(3));

let auth: FakeAuthService;
let repository: FakeReportRepository;
let online: boolean;

function deps(): SubmitReportDeps {
  return { auth, repository, isOnline: () => online };
}

beforeEach(() => {
  auth = new FakeAuthService();
  repository = new FakeReportRepository(new FakeClock(1_000));
  online = true;
});

describe('submitReport', () => {
  it('signs in, stores the sanitized text under the case key and returns the key', async () => {
    const result = await submitReport(TEXT, KEY, deps());
    expect(result).toEqual({ ok: true, value: { caseKey: KEY } });
    expect(auth.signIns).toBe(1);
    expect(repository.submitted).toEqual([{ caseKey: KEY, text: TEXT }]);
  });

  it('sends the optional category with the text', async () => {
    await submitReport(TEXT, KEY, deps(), { category: 'fraud' });
    expect(repository.submitted).toEqual([{ caseKey: KEY, text: TEXT, category: 'fraud' }]);
  });

  it('is idempotent: a retry with the same text and key succeeds without a second case', async () => {
    await submitReport(TEXT, KEY, deps());
    const retry = await submitReport(TEXT, KEY, deps());
    expect(retry).toEqual({ ok: true, value: { caseKey: KEY } });
    expect(repository.submitted).toHaveLength(1);
  });

  it('refuses a key that already holds a different report', async () => {
    await submitReport(approvedText('Another report.'), KEY, deps());
    const result = await submitReport(TEXT, KEY, deps());
    expect(result).toMatchObject({ ok: false, error: { kind: 'Unknown' } });
  });

  it('fails at once when offline: no sign-in, nothing queued', async () => {
    online = false;
    const result = await submitReport(TEXT, KEY, deps());
    expect(result).toMatchObject({ ok: false, error: { kind: 'Offline' } });
    expect(auth.signIns).toBe(0);
    expect(repository.submitted).toEqual([]);
  });

  it('stops when the anonymous sign-in fails', async () => {
    auth.failWith(createAppError('PermissionDenied', { message: 'no' }));
    const result = await submitReport(TEXT, KEY, deps());
    expect(result).toMatchObject({ ok: false, error: { kind: 'PermissionDenied' } });
    expect(repository.submitted).toEqual([]);
  });

  it('returns the repository error and no key', async () => {
    repository.failWith(createAppError('Offline', { message: 'unavailable' }));
    const result = await submitReport(TEXT, KEY, deps());
    expect(result).toMatchObject({ ok: false, error: { kind: 'Offline' } });
  });

  it('refuses a text longer than the organization accepts, before signing in', async () => {
    const long = approvedText('a'.repeat(MAX_SUBMITTED_CHARS + 1));
    const result = await submitReport(long, KEY, deps());
    expect(result).toMatchObject({ ok: false, error: { kind: 'InputTooLong' } });
    expect(auth.signIns).toBe(0);
  });

  it('never puts report text in an error message', async () => {
    online = false;
    const result = await submitReport(TEXT, KEY, deps());
    expect(JSON.stringify(result)).not.toContain('invoices');
  });
});

// Type-only values: these checks are compiled, never run.
declare const raw: RawText;
declare const consented: ConsentedRawText;
declare const repo: ReportRepository;

/** Never called: each line must fail to compile (`@ts-expect-error`), or typecheck fails. */
function rejectedAtCompileTime(): void {
  const caseKey = generateCaseKey(seededBytes(0));
  // @ts-expect-error RawText must be approved (approveReport) before it can be sent.
  assertType<NewReport>({ caseKey, text: raw });
  // @ts-expect-error ConsentedRawText (sent for a scan only) is not approved text.
  assertType<NewReport>({ caseKey, text: consented });
  // @ts-expect-error a plain string is not approved text either.
  void repo.submit({ caseKey, text: 'plain' });
  // @ts-expect-error the use case refuses RawText too.
  void submitReport(raw, KEY, deps());
  // @ts-expect-error and ConsentedRawText.
  void submitReport(consented, KEY, deps());
}

describe('submitReport: privacy by types', () => {
  it('accepts only SanitizedText for reporter content (see rejectedAtCompileTime)', () => {
    assertType<SanitizedText>(TEXT);
    expect(typeof rejectedAtCompileTime).toBe('function');
  });
});
