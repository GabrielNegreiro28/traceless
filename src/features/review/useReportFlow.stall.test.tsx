import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createFakeServices } from '../../app/services/renderWithServices';
import { ServicesProvider } from '../../app/services/ServicesProvider';
import { toRawText } from '../../domain/text/brandedText';
import { createAppError } from '../../shared/appError';
import { FINDINGS } from './reportFlowTestKit';
import { useReportFlow } from './useReportFlow';
import { capabilityOf, controllableScan, settle } from './useReportFlow.testKit';

/** The reporter's actions after a stalled on-device scan (§G.2). */

const TEXT = toRawText('I am the only night nurse on ward 7. Mail me at nurse@example.com.');
const stuck = (recoverable: boolean) =>
  createAppError('OnDeviceStuck', { message: 'stalled', recoverable });

function setup() {
  const scan = controllableScan();
  const services = createFakeServices({
    scanReport: scan.scanReport,
    deviceCapability: capabilityOf('available'),
  });
  const scanRulesOnly = vi.spyOn(services, 'scanRulesOnly');
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <ServicesProvider services={services}>{children}</ServicesProvider>
  );
  const hook = renderHook(() => useReportFlow(), { wrapper });
  return { ...hook, scan, services, scanRulesOnly };
}

type Setup = ReturnType<typeof setup>;

async function stallFirstScan(setupResult: Setup, recoverable: boolean): Promise<void> {
  act(() => setupResult.result.current.setText(TEXT));
  await settle(() => setupResult.result.current.startScan());
  await settle(() => setupResult.scan.calls[0]?.fail(stuck(recoverable)));
}

describe('useReportFlow after an on-device stall', () => {
  it('recoverable: Try again keeps the text and runs a new scan of it', async () => {
    const hook = setup();
    await stallFirstScan(hook, true);
    expect(hook.result.current.state).toMatchObject({ status: 'error', error: stuck(true) });

    await settle(() => hook.result.current.retryScan());
    expect(hook.scan.calls).toHaveLength(2);
    expect(hook.scan.calls[1]?.text).toBe(TEXT);
    expect(hook.result.current.state).toMatchObject({ status: 'scanning', text: TEXT });
    await settle(() => hook.scan.calls[1]?.succeed(FINDINGS));
    expect(hook.result.current.state).toMatchObject({ status: 'reviewing', checks: 'full' });
  });

  it('terminal: Try again does nothing; basic checks open a rules-only review', async () => {
    const hook = setup();
    await stallFirstScan(hook, false);
    await settle(() => hook.result.current.retryScan());
    expect(hook.scan.calls).toHaveLength(1);

    act(() => hook.result.current.continueWithBasicChecks());
    expect(hook.scanRulesOnly).toHaveBeenCalledExactlyOnceWith(TEXT);
    expect(hook.scan.calls).toHaveLength(1);
    const { state } = hook.result.current;
    if (state.status !== 'reviewing') throw new Error('expected the review');
    expect(state.checks).toBe('basic');
    expect(state.text).toBe(TEXT);
    expect(state.findings.map((f) => [f.quote, f.origin])).toEqual([['nurse@example.com', 'RULE']]);
    expect(hook.services.privacyLedger.entries()).toMatchObject([
      { task: 'identityScan', source: 'rules', dataClass: 'RAW', demo: false },
    ]);
  });

  it('recoverable: basic checks are not offered, so the action does nothing', async () => {
    const hook = setup();
    await stallFirstScan(hook, true);
    act(() => hook.result.current.continueWithBasicChecks());
    expect(hook.scanRulesOnly).not.toHaveBeenCalled();
    expect(hook.result.current.state.status).toBe('error');
    expect(hook.services.privacyLedger.entries()).toEqual([]);
  });
});
