import { assertType, describe, expect, it } from 'vitest';
import type { ConsentedRawText, RawText, SanitizedText } from '../../domain/text/brandedText';
import { FakeReportStructurer } from '../../infrastructure/fakes/FakeReportStructurer';
import { createAppError } from '../../shared/appError';
import type { ReportStructurer } from '../ports/ReportStructurer';
import { structureReport } from './structureReport';
import { approvedText } from './submitReport.testKit';

const TEXT = approvedText('On 14 March a manager approved false invoices.');

describe('structureReport', () => {
  it('returns the organized report and where it ran', async () => {
    const structurer = new FakeReportStructurer({ source: 'IN_CLOUD' });
    const result = await structureReport(TEXT, { structurer });
    expect(result).toMatchObject({ ok: true, value: { source: 'IN_CLOUD' } });
    expect(result.ok && result.value.report.category).toBe('fraud');
    expect(structurer.texts).toEqual([TEXT]);
  });

  it('drops when/where details that are not in the approved text', async () => {
    const report = {
      category: 'fraud' as const,
      summary: 'A manager approved false invoices.',
      when: 'On 14 March',
      where: 'Brackenford depot',
    };
    const result = await structureReport(TEXT, {
      structurer: new FakeReportStructurer({ report }),
    });
    expect(result.ok && result.value.report).toEqual({ ...report, where: null });
  });

  it('passes a structurer error through', async () => {
    const error = createAppError('Offline', { message: 'offline' });
    const result = await structureReport(TEXT, { structurer: new FakeReportStructurer({ error }) });
    expect(result).toEqual({ ok: false, error });
  });

  it('turns a throwing structurer into an Unknown error', async () => {
    const structurer: ReportStructurer = { structure: () => Promise.reject(new Error('x')) };
    const result = await structureReport(TEXT, { structurer });
    expect(result).toMatchObject({ ok: false, error: { kind: 'Unknown' } });
  });
});

// Type-only values: these checks are compiled, never run.
declare const raw: RawText;
declare const consented: ConsentedRawText;
declare const port: ReportStructurer;

/** Never called: each line must fail to compile (`@ts-expect-error`), or typecheck fails. */
function rejectedAtCompileTime(): void {
  const structurer = new FakeReportStructurer();
  // @ts-expect-error RawText never reaches the hybrid (cloud-capable) model.
  void port.structure(raw);
  // @ts-expect-error ConsentedRawText was consented for a scan only, not for this task.
  void port.structure(consented);
  // @ts-expect-error a plain string is not approved text.
  void port.structure('plain');
  // @ts-expect-error the use case refuses RawText too.
  void structureReport(raw, { structurer });
  // @ts-expect-error and ConsentedRawText.
  void structureReport(consented, { structurer });
}

describe('structureReport: privacy by types', () => {
  it('accepts only SanitizedText (see rejectedAtCompileTime)', () => {
    assertType<SanitizedText>(TEXT);
    expect(typeof rejectedAtCompileTime).toBe('function');
  });
});
