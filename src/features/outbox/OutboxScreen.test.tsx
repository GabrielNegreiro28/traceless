import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createFakeServices } from '../../app/services/renderWithServices';
import { ACKNOWLEDGEMENT_LABEL } from './outboxCopy';
import { OutboxScreen } from './OutboxScreen';
import { SCENARIOS } from './outboxTestKit';
import type { OutboxState } from '../review/reportFlowTypes';

function renderOutbox(state: OutboxState) {
  const onApprove = vi.fn();
  const onBackToReview = vi.fn();
  render(<OutboxScreen state={state} onApprove={onApprove} onBackToReview={onBackToReview} />);
  return { onApprove, onBackToReview };
}

const approveButton = () => screen.getByRole('button', { name: 'Approve this text' });
const checkbox = () => screen.queryByRole('checkbox', { name: ACKNOWLEDGEMENT_LABEL });

/** What the use case says for an unacknowledged approval of this outbox. */
function refusedForRisk(state: OutboxState): boolean {
  const { text, findings, decisions } = state;
  const result = createFakeServices().approveReport({
    text,
    findings,
    decisions,
    acknowledgedRemainingRisk: false,
  });
  return !result.ok && result.error.kind === 'RiskNotAcknowledged';
}

const scenario = (name: string): OutboxState => {
  const found = SCENARIOS.find(([n]) => n === name);
  if (found === undefined) throw new Error(name);
  return found[1];
};

describe('OutboxScreen: acknowledgement matrix', () => {
  it.each(SCENARIOS)('%s: checkbox shown exactly when approveReport requires it', (_n, state) => {
    renderOutbox(state);
    expect(checkbox() !== null).toBe(refusedForRisk(state));
  });

  it('the matrix covers both outcomes', () => {
    const outcomes = SCENARIOS.map(([, state]) => refusedForRisk(state));
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });
});

describe('OutboxScreen', () => {
  it('shows the preview read-only under its heading, with the residual risk', () => {
    const state = scenario('everything accepted');
    renderOutbox(state);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Only this text will leave your device' }),
    ).toBeVisible();
    expect(screen.getByText(state.preview)).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'Risk: none');
  });

  it('approves without acknowledgement when none is required', async () => {
    const { onApprove } = renderOutbox(scenario('everything accepted'));
    expect(checkbox()).toBeNull();
    expect(approveButton()).toBeEnabled();
    await userEvent.click(approveButton());
    expect(onApprove).toHaveBeenCalledWith(false);
  });

  it('keeps Approve disabled until the acknowledgement is ticked', async () => {
    const { onApprove } = renderOutbox(scenario('email kept'));
    expect(approveButton()).toBeDisabled();
    expect(approveButton()).toHaveAccessibleDescription('Tick the box above to approve.');
    expect(screen.getByText(/You also kept a name, email, phone or ID/)).toBeVisible();

    await userEvent.click(checkbox() as HTMLElement);
    expect(approveButton()).toBeEnabled();
    await userEvent.click(approveButton());
    expect(onApprove).toHaveBeenCalledWith(true);

    await userEvent.click(checkbox() as HTMLElement);
    expect(approveButton()).toBeDisabled();
  });

  it('Back to review returns to the review', async () => {
    const { onBackToReview, onApprove } = renderOutbox(scenario('location left pending'));
    await userEvent.click(screen.getByRole('button', { name: 'Back to review' }));
    expect(onBackToReview).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();
  });
});
