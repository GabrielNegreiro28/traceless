import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { LedgerEntry } from '../../application/ports/PrivacyLedger';
import { renderWithServices } from '../../app/services/renderWithServices';
import { toRawText } from '../../domain/text/brandedText';
import { ledgerLine } from './ledgerLabels';
import { PrivacyLedgerPanel } from './PrivacyLedgerPanel';

const entry = (overrides: Partial<LedgerEntry>): LedgerEntry => ({
  task: 'identityScan',
  source: 'onDevice',
  dataClass: 'RAW',
  demo: false,
  at: 0,
  ...overrides,
});

describe('ledgerLine', () => {
  it.each([
    [
      entry({}),
      'Identity scan · on your device (on-device AI) · your original text, never left this device',
    ],
    [
      entry({ source: 'local', demo: true }),
      'Identity scan · on your device (demo scanner) · your original text, never left this device',
    ],
    [
      entry({ source: 'rules' }),
      'Identity scan · on your device (pattern rules only) · your original text, never left this device',
    ],
    [
      entry({ source: 'cloud' }),
      'Identity scan · in the cloud, with your consent · your original text, sent for this scan only',
    ],
    [
      entry({ task: 'approve', source: 'local', dataClass: 'SANITIZED' }),
      'Approval · on your device · created the text you approved',
    ],
    [
      entry({ task: 'structureReport', dataClass: 'SANITIZED' }),
      'Organized for the organization · on your device (on-device AI) · only the text you approved',
    ],
    [
      entry({ task: 'structureReport', source: 'cloud', dataClass: 'SANITIZED' }),
      'Organized for the organization · in the cloud · only the text you approved',
    ],
    [
      entry({ task: 'structureReport', source: 'local', dataClass: 'SANITIZED', demo: true }),
      'Organized for the organization · on your device (demo organizer) · only the text you approved',
    ],
  ])('%o reads as a plain sentence', (value, line) => {
    expect(ledgerLine(value)).toBe(line);
  });
});

describe('PrivacyLedgerPanel', () => {
  it('is collapsed by default and says when nothing has happened yet', async () => {
    renderWithServices(<PrivacyLedgerPanel />);
    const summary = screen.getByText('What happened to your text');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    await userEvent.click(summary);
    expect(screen.getByText('Nothing has happened to your text yet.')).toBeVisible();
  });

  it('lists each step as it is recorded, without any of the text', async () => {
    const { services } = renderWithServices(<PrivacyLedgerPanel />);
    const text = toRawText('Wexford manifests were altered.');
    await act(async () => {
      await services.scanReport(text);
    });
    act(() => {
      services.approveReport({
        text,
        findings: [],
        decisions: [],
        acknowledgedRemainingRisk: false,
      });
    });
    await userEvent.click(screen.getByText('What happened to your text'));
    const items = within(screen.getByRole('list', { name: 'Steps so far' })).getAllByRole(
      'listitem',
    );
    expect(items.map((item) => item.textContent)).toEqual([
      'Identity scan · on your device (demo scanner) · your original text, never left this device',
      'Approval · on your device · created the text you approved',
    ]);
    expect(document.body.textContent).not.toContain('Wexford');
  });
});
