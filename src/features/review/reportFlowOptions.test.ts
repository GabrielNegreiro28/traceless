import { describe, expect, it } from 'vitest';
import type { CloudScanConsent } from '../../application/usecases/consentToCloudScan';
import { reportFlowReducer, type FlowEvent, type FlowState } from './reportFlowMachine';
import { FAILURE, FINDINGS, SCAN_ID, TEXT } from './reportFlowTestKit';

const needsConsent: FlowState = { status: 'needsConsent', text: TEXT };
const needsPrepare: FlowState = { status: 'needsPrepare', text: TEXT, progress: 0.4 };
const OWN_TEXT: CloudScanConsent = { kind: 'own-text', acknowledged: true };

const cloudScan = (consent: unknown, scanId = SCAN_ID): FlowEvent =>
  ({ type: 'START_CLOUD_SCAN', scanId, consent }) as FlowEvent;

function reduce(state: FlowState, ...events: FlowEvent[]): FlowState {
  return events.reduce(reportFlowReducer, state);
}

describe('reportFlowOptions: START_CLOUD_SCAN', () => {
  it.each([OWN_TEXT, { kind: 'sample' }])('starts a consented cloud scan (%o)', (consent) => {
    expect(reduce(needsConsent, cloudScan(consent))).toEqual({
      status: 'scanning',
      text: TEXT,
      mode: 'consentedCloud',
      consent,
      scanId: SCAN_ID,
      progress: null,
    });
  });

  it.each([
    undefined,
    null,
    {},
    { kind: 'own-text' },
    { kind: 'own-text', acknowledged: false },
    { kind: 'own-text', acknowledged: 'yes' },
    { kind: 'other' },
    'sample',
  ])('is refused without a valid consent (%o)', (consent) => {
    expect(reduce(needsConsent, cloudScan(consent))).toBe(needsConsent);
  });

  it.each([''])('is refused without a scan id (%o)', (scanId) => {
    expect(reduce(needsConsent, cloudScan(OWN_TEXT, scanId))).toBe(needsConsent);
  });

  it('is ignored outside the options screen', () => {
    const composing: FlowState = { status: 'composing', text: TEXT };
    expect(reduce(composing, cloudScan(OWN_TEXT))).toBe(composing);
    expect(reduce(needsPrepare, cloudScan(OWN_TEXT))).toBe(needsPrepare);
  });
});

describe('reportFlowOptions: other ways forward', () => {
  it('SHOW_OPTIONS leaves the download for the options screen', () => {
    expect(reduce(needsPrepare, { type: 'SHOW_OPTIONS' })).toEqual(needsConsent);
  });

  it('BASIC_CHECKS_DONE opens a basic review of the pattern findings', () => {
    const next = reduce(needsConsent, { type: 'BASIC_CHECKS_DONE', findings: FINDINGS });
    expect(next).toMatchObject({
      status: 'reviewing',
      text: TEXT,
      checks: 'basic',
      findings: FINDINGS,
      decisions: [],
    });
  });

  it('a successful cloud scan opens a review checked in the cloud', () => {
    const next = reduce(needsConsent, cloudScan(OWN_TEXT), {
      type: 'SCAN_DONE',
      scanId: SCAN_ID,
      findings: FINDINGS,
    });
    expect(next).toMatchObject({ status: 'reviewing', checks: 'cloud', findings: FINDINGS });
    expect(next).not.toHaveProperty('consent');
  });

  it('a failed cloud scan shows the error, then returns to the options', () => {
    const failed = reduce(needsConsent, cloudScan(OWN_TEXT), {
      type: 'SCAN_FAILED',
      scanId: SCAN_ID,
      error: FAILURE,
    });
    expect(failed).toEqual({ status: 'error', error: FAILURE, previous: needsConsent });
    expect(reduce(failed, { type: 'BACK_TO_EDIT' })).toEqual(needsConsent);
  });
});
