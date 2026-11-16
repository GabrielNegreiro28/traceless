import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Services } from '../../app/compositionRoot';
import { toRawText } from '../../domain/text/brandedText';
import { createAppError, type AppError } from '../../shared/appError';
import { err } from '../../shared/result';
import { approvedReport, FINDINGS, TEXT } from './reportFlowTestKit';
import { useReportFlow } from './useReportFlow';
import { capabilityOf, controllableScan, servicesWrapper, settle } from './useReportFlow.testKit';

function setup(overrides: Partial<Services> = {}) {
  const scan = controllableScan();
  const hook = renderHook(() => useReportFlow(), {
    wrapper: servicesWrapper({
      scanReport: scan.scanReport,
      deviceCapability: capabilityOf('available'),
      ...overrides,
    }),
  });
  return { ...hook, scan };
}

type Hook = ReturnType<typeof setup>;

/** Scan, accept every finding (risk NONE), then open the outbox. */
async function reachOutbox(hook: Hook): Promise<void> {
  act(() => hook.result.current.setText(TEXT));
  await settle(() => hook.result.current.startScan());
  await settle(() => hook.scan.calls[0]?.succeed(FINDINGS));
  for (const finding of FINDINGS) {
    act(() => hook.result.current.decide(finding.id, { action: 'ACCEPTED' }));
  }
  act(() => hook.result.current.confirmSecondLook(true));
  act(() => hook.result.current.openOutbox());
  expect(hook.result.current.state.status).toBe('outbox');
}

const refusal = (error: AppError): Services['approveReport'] => vi.fn(() => err(error));

describe('useReportFlow: approve', () => {
  it('approves exactly the previewed text through the services', async () => {
    const hook = setup();
    await reachOutbox(hook);
    const { state } = hook.result.current;
    const preview = state.status === 'outbox' ? state.preview : null;
    act(() => hook.result.current.approve(false));
    const approved = hook.result.current.state;
    expect(approved.status).toBe('approved');
    expect(approved.status === 'approved' && approved.report.text).toBe(preview);
  });

  it('passes the outbox review and the acknowledgement to approveReport', async () => {
    const approveReport = vi.fn(() => err(createAppError('EmptyReport', { message: 'x' })));
    const hook = setup({ approveReport });
    await reachOutbox(hook);
    act(() => hook.result.current.approve(true));
    expect(approveReport).toHaveBeenCalledWith({
      text: TEXT,
      findings: FINDINGS,
      decisions: expect.any(Array) as unknown,
      acknowledgedRemainingRisk: true,
      previewedText: expect.any(String) as unknown,
    });
  });

  it.each([
    createAppError('DirectIdentifierRemains', { message: 'x', count: 1 }),
    createAppError('RiskNotAcknowledged', { message: 'x', level: 'HIGH' }),
    createAppError('EmptyReport', { message: 'x' }),
  ])('a $kind refusal shows the error over the outbox', async (error) => {
    const hook = setup({ approveReport: refusal(error) });
    await reachOutbox(hook);
    act(() => hook.result.current.approve(false));
    expect(hook.result.current.state).toMatchObject({
      status: 'error',
      error: { kind: error.kind },
      previous: { status: 'outbox' },
    });
  });

  it('never approves a text that differs from the preview', async () => {
    const other = approvedReport(toRawText('A completely different report.'));
    const hook = setup({ approveReport: vi.fn(() => ({ ok: true as const, value: other })) });
    await reachOutbox(hook);
    act(() => hook.result.current.approve(false));
    expect(hook.result.current.state).toMatchObject({
      status: 'error',
      error: { kind: 'ApprovalMismatch' },
    });
  });

  it('maps a thrown approval to an Unknown error', async () => {
    const approveReport = vi.fn(() => {
      throw new Error('boom');
    });
    const hook = setup({ approveReport });
    await reachOutbox(hook);
    act(() => hook.result.current.approve(false));
    expect(hook.result.current.state).toMatchObject({
      status: 'error',
      error: { kind: 'Unknown' },
    });
  });

  it('does nothing outside the outbox', () => {
    const approveReport = vi.fn();
    const hook = setup({ approveReport });
    act(() => hook.result.current.approve(true));
    expect(approveReport).not.toHaveBeenCalled();
    expect(hook.result.current.state.status).toBe('composing');
  });

  it('backToReview reopens the review after a refusal; backToEdit the outbox', async () => {
    const error = createAppError('EmptyReport', { message: 'x' });
    const hook = setup({ approveReport: refusal(error) });
    await reachOutbox(hook);
    act(() => hook.result.current.approve(false));
    act(() => hook.result.current.backToEdit());
    expect(hook.result.current.state.status).toBe('outbox');
    act(() => hook.result.current.approve(false));
    act(() => hook.result.current.backToReview());
    expect(hook.result.current.state).toMatchObject({ status: 'reviewing', findings: FINDINGS });
  });
});
