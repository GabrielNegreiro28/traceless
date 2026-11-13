import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DeviceAvailability } from '../../application/ports/DeviceCapability';
import { createAppError } from '../../shared/appError';
import { ok } from '../../shared/result';
import { FINDINGS, TEXT } from './reportFlowTestKit';
import { useReportFlow } from './useReportFlow';
import { capabilityOf, controllableScan, servicesWrapper, settle } from './useReportFlow.testKit';

function setup(availability: DeviceAvailability) {
  const scan = controllableScan();
  const capability = capabilityOf(availability);
  const hook = renderHook(() => useReportFlow(), {
    wrapper: servicesWrapper({ scanReport: scan.scanReport, deviceCapability: capability }),
  });
  return { ...hook, scan, capability };
}

type Hook = ReturnType<typeof setup>;

async function clickCheck(hook: Hook): Promise<void> {
  act(() => hook.result.current.setText(TEXT));
  await settle(() => hook.result.current.startScan());
}

describe.each<DeviceAvailability>(['downloadable', 'downloading'])(
  'useReportFlow with a %s on-device model',
  (availability) => {
    it('goes to the prepare step without scanning or preparing', async () => {
      const hook = setup(availability);
      await clickCheck(hook);
      expect(hook.result.current.state).toEqual({
        status: 'needsPrepare',
        text: TEXT,
        progress: null,
      });
      expect(hook.scan.calls).toHaveLength(0);
      expect(hook.capability.prepareCalls()).toBe(0);
    });

    it('starts the download from its own click, shows progress, then scans', async () => {
      const hook = setup(availability);
      await clickCheck(hook);

      act(() => hook.result.current.prepare());
      // Called synchronously inside the click handler (user activation), not after an await.
      expect(hook.capability.prepareCalls()).toBe(1);
      expect(hook.result.current.state).toMatchObject({ status: 'needsPrepare', progress: 0 });

      act(() => hook.capability.progress(0.4));
      expect(hook.result.current.state).toMatchObject({ progress: 0.4 });

      await settle(() => hook.capability.finish(ok(undefined)));
      expect(hook.result.current.state).toMatchObject({ status: 'scanning', mode: 'onDevice' });
      expect(hook.scan.calls).toHaveLength(1);
      expect(hook.scan.calls[0]?.text).toBe(TEXT);

      await settle(() => hook.scan.calls[0]?.succeed(FINDINGS));
      expect(hook.result.current.state.status).toBe('reviewing');
    });

    it('ignores a second click while the download runs', async () => {
      const hook = setup(availability);
      await clickCheck(hook);
      act(() => hook.result.current.prepare());
      act(() => hook.result.current.prepare());
      expect(hook.capability.prepareCalls()).toBe(1);
    });

    it('a failed download shows the error and Try again returns to the prepare step', async () => {
      const hook = setup(availability);
      await clickCheck(hook);
      act(() => hook.result.current.prepare());
      const error = createAppError('Offline', { message: 'offline' });
      await settle(() => hook.capability.finish({ ok: false, error }));
      expect(hook.result.current.state).toMatchObject({ status: 'error', error });
      expect(hook.scan.calls).toHaveLength(0);

      act(() => hook.result.current.backToEdit());
      expect(hook.result.current.state).toEqual({
        status: 'needsPrepare',
        text: TEXT,
        progress: null,
      });
    });

    it('Back during the download returns to the text and ignores the late result', async () => {
      const hook = setup(availability);
      await clickCheck(hook);
      act(() => hook.result.current.prepare());
      act(() => hook.result.current.backToEdit());
      expect(hook.result.current.state).toEqual({ status: 'composing', text: TEXT });

      act(() => hook.capability.progress(0.9));
      await settle(() => hook.capability.finish(ok(undefined)));
      expect(hook.result.current.state).toEqual({ status: 'composing', text: TEXT });
      expect(hook.scan.calls).toHaveLength(0);
    });
  },
);

describe('useReportFlow device check', () => {
  it('scans only when the model is available', async () => {
    const hook = setup('available');
    await clickCheck(hook);
    expect(hook.result.current.state.status).toBe('scanning');
    expect(hook.capability.prepareCalls()).toBe(0);
  });

  it('treats a rejected check as unavailable and resets the checking flag', async () => {
    const hook = setup('available');
    vi.spyOn(hook.capability, 'check').mockRejectedValue(new Error('chrome exploded'));
    await clickCheck(hook);
    expect(hook.result.current.state).toEqual({ status: 'needsConsent', text: TEXT });
    expect(hook.result.current.checking).toBe(false);
    expect(hook.scan.calls).toHaveLength(0);
  });

  it('shows the consent step when on-device AI is unavailable', async () => {
    const hook = setup('unavailable');
    await clickCheck(hook);
    expect(hook.result.current.state).toEqual({ status: 'needsConsent', text: TEXT });
    expect(hook.scan.calls).toHaveLength(0);
    expect(hook.capability.prepareCalls()).toBe(0);
  });
});
