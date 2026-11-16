import { describe, expect, it } from 'vitest';
import { isReportCategory, keepGroundedDetails, type StructuredReport } from './structuredReport';

const SOURCE = 'On 14 March, at the loading dock, a manager approved false invoices.';
const REPORT: StructuredReport = {
  category: 'fraud',
  summary: 'A manager approved false invoices.',
  when: 'On 14 March',
  where: 'at the loading dock',
};

describe('keepGroundedDetails', () => {
  it('keeps when/where quoted from the approved text (case and spacing ignored)', () => {
    const report = { ...REPORT, when: 'on 14  march' };
    expect(keepGroundedDetails(report, SOURCE)).toEqual(report);
  });

  it('drops a date or place the approved text does not contain', () => {
    const report = { ...REPORT, when: '15 March', where: 'Brackenford depot' };
    expect(keepGroundedDetails(report, SOURCE)).toEqual({ ...REPORT, when: null, where: null });
  });

  it('keeps null and drops blank values', () => {
    const report = { ...REPORT, when: null, where: '  ' };
    expect(keepGroundedDetails(report, SOURCE)).toMatchObject({ when: null, where: null });
  });
});

describe('isReportCategory', () => {
  it('accepts only the closed list', () => {
    expect(isReportCategory('retaliation')).toBe(true);
    expect(isReportCategory('Fraud')).toBe(false);
    expect(isReportCategory(3)).toBe(false);
  });
});
