import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { logger } from '../../shared/logger';
import { FAILURE, FINDINGS, TEXT } from './reportFlowTestKit';
import { useReportFlow } from './useReportFlow';
import { capabilityOf, controllableScan, servicesWrapper, settle } from './useReportFlow.testKit';

function setup(availability: 'available' | 'unavailable' = 'available') {
  const scan = controllableScan();
  const deviceCapability = capabilityOf(availability);
  const hook = renderHook(() => useReportFlow(), {
    wrapper: servicesWrapper({ scanReport: scan.scanReport, deviceCapability }),
  });
  return { ...hook, scan };
}

type Hook = ReturnType<typeof setup>;

async function clickCheck(hook: Hook): Promise<void> {
  await settle(() => hook.result.current.startScan());
}

async function startWith(hook: Hook, text: string = TEXT): Promise<void> {
  act(() => hook.result.current.setText(text));
  await clickCheck(hook);
}

describe('useReportFlow', () => {
  it('starts composing with empty text', () => {
    const { result } = setup();
    expect(result.current.state).toEqual({ status: 'composing', text: '' });
    expect(result.current.checking).toBe(false);
  });

  it('does not scan an empty report', async () => {
    const hook = setup();
    await startWith(hook, '   ');
    expect(hook.result.current.state.status).toBe('composing');
    expect(hook.scan.calls).toHaveLength(0);
  });

  it('scans the text, reports chunk progress and opens the review with the shipped findings', async () => {
    const hook = setup();
    await startWith(hook);
    const [call] = hook.scan.calls;
    expect(hook.scan.calls).toHaveLength(1);
    expect(call?.text).toBe(TEXT);
    expect(hook.result.current.state).toMatchObject({ status: 'scanning', progress: null });

    act(() => call?.onProgress?.(0, 3));
    act(() => call?.onProgress?.(1, 3));
    expect(hook.result.current.state).toMatchObject({ progress: { done: 1, total: 3 } });

    await settle(() => call?.succeed(FINDINGS));
    expect(hook.result.current.state).toMatchObject({
      status: 'reviewing',
      text: TEXT,
      findings: FINDINGS,
      decisions: [],
    });
  });

  it('cancel returns to composing with the text intact', async () => {
    const hook = setup();
    await startWith(hook);
    act(() => hook.result.current.cancelScan());
    expect(hook.result.current.state).toEqual({ status: 'composing', text: TEXT });
  });

  it('ignores every event from a cancelled scan, even after a new scan started', async () => {
    const hook = setup();
    await startWith(hook);
    act(() => hook.result.current.cancelScan());
    await clickCheck(hook);
    const [first, second] = hook.scan.calls;
    expect(hook.scan.calls).toHaveLength(2);

    act(() => first?.onProgress?.(2, 2));
    await settle(() => first?.succeed(FINDINGS));
    expect(hook.result.current.state).toMatchObject({ status: 'scanning', progress: null });

    await settle(() => second?.succeed([]));
    expect(hook.result.current.state).toMatchObject({ status: 'reviewing', findings: [] });
  });

  it('a late result after cancel does not reopen the review', async () => {
    const hook = setup();
    await startWith(hook);
    act(() => hook.result.current.cancelScan());
    await settle(() => hook.scan.calls[0]?.succeed(FINDINGS));
    expect(hook.result.current.state.status).toBe('composing');
  });

  it('ignores late results after unmount', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const hook = setup();
    await startWith(hook);
    hook.unmount();
    await settle(() => hook.scan.calls[0]?.fail(FAILURE));
    expect(warn).not.toHaveBeenCalled();
  });

  it('a failed scan shows the error; trying again returns to the text, then scans again', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const hook = setup();
    await startWith(hook);
    await settle(() => hook.scan.calls[0]?.fail(FAILURE));
    expect(hook.result.current.state).toMatchObject({ status: 'error', error: FAILURE });
    expect(warn).toHaveBeenCalledWith('Scan failed', { kind: 'Offline' });

    act(() => hook.result.current.backToEdit());
    expect(hook.result.current.state).toEqual({ status: 'composing', text: TEXT });

    await clickCheck(hook);
    await settle(() => hook.scan.calls[1]?.succeed(FINDINGS));
    expect(hook.result.current.state.status).toBe('reviewing');
  });

  it('turns a thrown scan into an Unknown error and logs only the kind', async () => {
    const error = vi.spyOn(logger, 'error');
    const hook = setup();
    await startWith(hook);
    await settle(() => hook.scan.calls[0]?.crash());
    expect(hook.result.current.state).toMatchObject({
      status: 'error',
      error: { kind: 'Unknown' },
    });
    expect(error).toHaveBeenCalledWith('Scan threw', { kind: 'Unknown' });
  });

  it('asks for consent, without scanning, when on-device AI is unavailable', async () => {
    const hook = setup('unavailable');
    await startWith(hook);
    expect(hook.result.current.state).toEqual({ status: 'needsConsent', text: TEXT });
    expect(hook.scan.calls).toHaveLength(0);
    act(() => hook.result.current.backToEdit());
    expect(hook.result.current.state).toEqual({ status: 'composing', text: TEXT });
  });

  it('shows checking while the device is checked and starts one scan on a double click', async () => {
    let release: (value: 'available') => void = () => undefined;
    const slow = capabilityOf('available');
    vi.spyOn(slow, 'check').mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const scan = controllableScan();
    const hook = renderHook(() => useReportFlow(), {
      wrapper: servicesWrapper({ scanReport: scan.scanReport, deviceCapability: slow }),
    });
    act(() => hook.result.current.setText(TEXT));
    act(() => hook.result.current.startScan());
    expect(hook.result.current.checking).toBe(true);
    act(() => hook.result.current.startScan());
    await settle(() => release('available'));
    expect(hook.result.current.checking).toBe(false);
    expect(scan.calls).toHaveLength(1);
  });

  it('reset goes back to an empty composer', async () => {
    const hook = setup();
    await startWith(hook);
    act(() => hook.result.current.reset());
    expect(hook.result.current.state).toEqual({ status: 'composing', text: '' });
  });

  it('carries the protected spans into the review and decides, undoes and opens the outbox', async () => {
    const hook = setup();
    await startWith(hook);
    const spans = [{ start: 31, end: 42 }];
    await settle(() => hook.scan.calls[0]?.succeed(FINDINGS, spans));
    expect(hook.result.current.state).toMatchObject({ status: 'reviewing', protectedSpans: spans });

    const id = FINDINGS[1]?.id ?? '';
    act(() => hook.result.current.decide(id, { action: 'KEPT_RISK' }));
    expect(hook.result.current.state).toMatchObject({
      decisions: [{ findingId: id, action: 'KEPT_RISK' }],
    });
    act(() => hook.result.current.undoDecision(id));
    expect(hook.result.current.state).toMatchObject({ decisions: [] });
    act(() => hook.result.current.confirmSecondLook(true));
    act(() => hook.result.current.openOutbox());
    expect(hook.result.current.state.status).toBe('outbox');
  });

  it('back to edit from the review and a new check scans again', async () => {
    const hook = setup();
    await startWith(hook);
    await settle(() => hook.scan.calls[0]?.succeed(FINDINGS));
    act(() => hook.result.current.backToEdit());
    expect(hook.result.current.state.status).toBe('composing');
    await clickCheck(hook);
    expect(hook.scan.calls).toHaveLength(2);
  });
});
