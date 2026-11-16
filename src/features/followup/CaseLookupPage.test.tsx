import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_CONFIG, type ConfigService } from '../../application/ports/ConfigService';
import type { CaseRecord } from '../../application/ports/ReportRepository';
import { renderWithServices } from '../../app/services/renderWithServices';
import { generateCaseKey, groupCaseKey } from '../../domain/case/caseKey';
import { toRawText } from '../../domain/text/brandedText';
import { createAppError } from '../../shared/appError';
import { err, ok } from '../../shared/result';
import { CaseLookupPage } from './CaseLookupPage';

const KEY = generateCaseKey((length) => new Uint8Array(length).fill(42));
const CREATED = Date.UTC(2026, 10, 16, 12);
const RECORD: CaseRecord = {
  caseKey: KEY,
  sanitizedText: 'Invoices were approved twice by a manager.',
  status: 'received',
  createdAt: CREATED,
};

const config = (ack: number, feedback: number): ConfigService => ({
  load: () =>
    Promise.resolve({
      ...DEFAULT_APP_CONFIG,
      ackDeadlineDays: ack,
      feedbackDeadlineDays: feedback,
    }),
});

async function lookUp(input: string): Promise<void> {
  await userEvent.type(screen.getByLabelText('Case key'), input);
  await userEvent.click(screen.getByRole('button', { name: 'Look up case' }));
}

describe('CaseLookupPage', () => {
  it('shows the received date, the deadlines and the submitted text', async () => {
    const lookUpCase = vi.fn(() => Promise.resolve(ok(RECORD)));
    renderWithServices(<CaseLookupPage />, { lookUpCase, config: config(7, 90) });
    await lookUp(groupCaseKey(KEY).join(' '));

    expect(await screen.findByRole('heading', { name: 'Case status' })).toBeVisible();
    expect(lookUpCase).toHaveBeenCalledWith(groupCaseKey(KEY).join(' '));
    expect(screen.getByText('Report received')).toBeVisible();
    expect(screen.getByText('November 16, 2026')).toBeVisible();
    expect(screen.getByText(/November 23, 2026/)).toBeVisible();
    expect(screen.getByText(/February 14, 2027/)).toBeVisible();
    expect(screen.getByText(RECORD.sanitizedText)).toBeVisible();
  });

  it('uses the deadlines from the config', async () => {
    const lookUpCase = vi.fn(() =>
      Promise.resolve(ok<CaseRecord>({ ...RECORD, status: 'acknowledged' })),
    );
    renderWithServices(<CaseLookupPage />, { lookUpCase, config: config(3, 30) });
    await lookUp(KEY);
    expect(await screen.findByText('Done (due by November 19, 2026)')).toBeVisible();
    expect(screen.getByText(/December 16, 2026/)).toBeVisible();
  });

  it('shows a friendly message when no case matches', async () => {
    const notFound = createAppError('NotFound', { message: 'no case' });
    renderWithServices(<CaseLookupPage />, {
      lookUpCase: () => Promise.resolve(err(notFound)),
    });
    await lookUp('wrong key');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't find a case with that key. Check it and try again.",
    );
  });

  it('does nothing for an empty key and keeps the input out of autofill', async () => {
    const lookUpCase = vi.fn();
    renderWithServices(<CaseLookupPage />, { lookUpCase });
    await userEvent.click(screen.getByRole('button', { name: 'Look up case' }));
    expect(lookUpCase).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Case key')).toHaveAttribute('autocomplete', 'off');
  });

  it('finds a case sent in demo mode in the same tab (fake backend)', async () => {
    const { services } = renderWithServices(<CaseLookupPage />);
    const sent = services.approveReport({
      text: toRawText(RECORD.sanitizedText),
      findings: [],
      decisions: [],
      acknowledgedRemainingRisk: false,
    });
    if (!sent.ok) throw new Error('approval failed');
    const submitted = await services.submitReport(sent.value.text, services.issueCaseKey());
    if (!submitted.ok) throw new Error('submit failed');
    await lookUp(submitted.value.caseKey);
    expect(await screen.findByText(RECORD.sanitizedText)).toBeVisible();
  });
});
