import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Services } from '../../app/compositionRoot';
import type { CloudScanConsent } from '../../application/usecases/consentToCloudScan';
import { createAppError } from '../../shared/appError';
import { err } from '../../shared/result';
import type { FlowState } from './reportFlowMachine';
import { reviewing, scanning, TEXT } from './reportFlowTestKit';
import { useConsentedCloudScan } from './useConsentedCloudScan';
import { settle } from './useReportFlow.testKit';

const CONSENT: CloudScanConsent = { kind: 'own-text', acknowledged: true };
const cloudScanning: FlowState = { ...scanning, mode: 'consentedCloud', consent: CONSENT };

type CloudScan = Services['scanWithCloudConsent'];

/** A cloud scan that stays pending. */
function pendingCloudScan() {
  const scan = vi.fn<CloudScan>(() => new Promise(() => undefined));
  return { scan };
}

function run(state: FlowState, scan: CloudScan) {
  const dispatch = vi.fn();
  const view = renderHook(() => useConsentedCloudScan(state, dispatch, scan));
  return { dispatch, ...view };
}

describe('useConsentedCloudScan', () => {
  it('scans exactly this text with exactly this consent', () => {
    const { scan } = pendingCloudScan();
    run(cloudScanning, scan);
    expect(scan).toHaveBeenCalledOnce();
    expect(scan.mock.calls[0]?.[0]).toBe(TEXT);
    expect(scan.mock.calls[0]?.[1]).toBe(CONSENT);
  });

  it.each<[string, FlowState]>([
    ['a cloud scanning state without a consent', { ...scanning, mode: 'consentedCloud' }],
    ['an on-device scanning state', { ...scanning, consent: CONSENT }],
    ['a review', reviewing],
    ['the options screen', { status: 'needsConsent', text: TEXT }],
  ])('never scans for %s', (_label, state) => {
    const { scan } = pendingCloudScan();
    run(state, scan);
    expect(scan).not.toHaveBeenCalled();
  });

  it('cancels the scan on unmount and never dispatches its late result', async () => {
    let finish: (outcome: Awaited<ReturnType<CloudScan>>) => void = () => undefined;
    const checks: (() => boolean)[] = [];
    const scan = vi.fn<CloudScan>((_t, _c, _p, isCancelled) => {
      if (isCancelled !== undefined) checks.push(isCancelled);
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { dispatch, unmount } = run(cloudScanning, scan);
    expect(checks[0]?.()).toBe(false);

    unmount();
    expect(checks[0]?.()).toBe(true);
    await settle(() => finish(err(createAppError('Unknown', { message: 'late' }))));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
