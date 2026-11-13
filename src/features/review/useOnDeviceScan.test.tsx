import { renderHook } from '@testing-library/react';
import { useReducer } from 'react';
import { describe, expect, it } from 'vitest';
import { useServices } from '../../app/services/useServices';
import { reportFlowReducer, type FlowState } from './reportFlowMachine';
import { scanning, TEXT } from './reportFlowTestKit';
import { useOnDeviceScan } from './useOnDeviceScan';
import { useReportFlow } from './useReportFlow';
import { controllableScan, servicesWrapper, settle } from './useReportFlow.testKit';

function useHarness(initial: FlowState) {
  const { scanReport } = useServices();
  const [state, dispatch] = useReducer(reportFlowReducer, initial);
  useOnDeviceScan(state, dispatch, scanReport);
  return state;
}

describe('useOnDeviceScan', () => {
  it('runs the scan for an on-device scanning state', () => {
    const scan = controllableScan();
    renderHook(() => useHarness(scanning), {
      wrapper: servicesWrapper({ scanReport: scan.scanReport }),
    });
    expect(scan.calls).toHaveLength(1);
    expect(scan.calls[0]?.text).toBe(TEXT);
  });

  it('never runs a scan of another mode (the future consented cloud scan)', () => {
    const scan = controllableScan();
    renderHook(() => useHarness({ ...scanning, mode: 'consentedCloud' }), {
      wrapper: servicesWrapper({ scanReport: scan.scanReport }),
    });
    expect(scan.calls).toHaveLength(0);
  });

  it('passes a cancellation check that turns true once the scan is left', async () => {
    let isCancelled: (() => boolean) | undefined;
    const scanReport: ReturnType<typeof controllableScan>['scanReport'] = (
      _text,
      _p,
      cancelled,
    ) => {
      isCancelled = cancelled;
      return new Promise(() => undefined);
    };
    const hook = renderHook(() => useReportFlow(), { wrapper: servicesWrapper({ scanReport }) });
    await settle(() => {
      hook.result.current.setText(TEXT);
    });
    await settle(() => hook.result.current.startScan());
    expect(isCancelled?.()).toBe(false);
    await settle(() => hook.result.current.cancelScan());
    expect(isCancelled?.()).toBe(true);
  });
});

describe('useReportFlow in StrictMode', () => {
  it('runs the scan exactly once', async () => {
    const scan = controllableScan();
    const hook = renderHook(() => useReportFlow(), {
      wrapper: servicesWrapper({ scanReport: scan.scanReport }),
      reactStrictMode: true,
    });
    await settle(() => {
      hook.result.current.setText(TEXT);
    });
    await settle(() => hook.result.current.startScan());
    expect(hook.result.current.state.status).toBe('scanning');
    expect(scan.calls).toHaveLength(1);
  });
});
