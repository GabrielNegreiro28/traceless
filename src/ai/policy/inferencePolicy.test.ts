import type { InferenceMode } from 'firebase/ai';
import { describe, expect, it } from 'vitest';
import {
  AI_TASKS,
  INFERENCE_MODES,
  INFERENCE_POLICY,
  policyFor,
  type AllowedModes,
  type InferenceModeName,
  type PolicyRow,
} from './inferencePolicy';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <T extends true>(value: T): T => value;

describe('INFERENCE_POLICY', () => {
  it('mirrors the SDK InferenceMode runtime values exactly (type-level parity)', () => {
    expect(assertType<Equals<InferenceModeName, InferenceMode>>(true)).toBe(true);
    expect(Object.values(INFERENCE_MODES).sort()).toEqual(
      ['only_in_cloud', 'only_on_device', 'prefer_in_cloud', 'prefer_on_device'].sort(),
    );
  });

  it('has exactly one row per task', () => {
    expect(Object.keys(INFERENCE_POLICY).sort()).toEqual([...AI_TASKS].sort());
  });

  it('runs every RAW task strictly on the device', () => {
    const rawRows = Object.values(INFERENCE_POLICY).filter((row) => row.dataClass === 'RAW');
    expect(rawRows.length).toBeGreaterThan(0);
    for (const row of rawRows) expect(row.mode).toBe(INFERENCE_MODES.ONLY_ON_DEVICE);
  });

  it('never gives cloud-only tools or multi-turn chat to an on-device-only task', () => {
    for (const row of Object.values(INFERENCE_POLICY)) {
      if (row.mode !== 'only_on_device') continue;
      expect(row.tools).toEqual([]);
      expect(row.multiTurn).toBe(false);
    }
  });

  it('matches the PLANO §3.3 routing table', () => {
    expect(policyFor('identityScan')).toMatchObject({ dataClass: 'RAW', mode: 'only_on_device' });
    expect(policyFor('styleNeutralize')).toMatchObject({
      dataClass: 'RAW',
      mode: 'only_on_device',
    });
    expect(policyFor('structureReport')).toMatchObject({
      dataClass: 'SANITIZED',
      mode: 'prefer_on_device',
    });
    expect(policyFor('adviseRights')).toMatchObject({
      dataClass: 'SANITIZED',
      mode: 'only_in_cloud',
      tools: ['googleSearch'],
    });
    expect(policyFor('triageCase').mode).toBe('only_in_cloud');
    expect(policyFor('draftReply').mode).toBe('only_in_cloud');
    expect(policyFor('caseChat')).toMatchObject({ mode: 'only_in_cloud', multiTurn: true });
    expect(policyFor('identityScanConsented')).toMatchObject({
      dataClass: 'CONSENTED_RAW',
      mode: 'only_in_cloud',
    });
  });

  it('documents every row with a short English rationale', () => {
    for (const row of Object.values(INFERENCE_POLICY)) {
      expect(row.rationale.length).toBeGreaterThan(20);
      expect(row.rationale.length).toBeLessThanOrEqual(120);
    }
  });

  it('rejects at compile time a RAW row with any other mode', () => {
    expect(assertType<Equals<AllowedModes<'RAW'>, 'only_on_device'>>(true)).toBe(true);
    // @ts-expect-error RAW text may only use ONLY_ON_DEVICE.
    const rawPrefer: AllowedModes<'RAW'> = 'prefer_on_device';
    // @ts-expect-error a RAW row with a cloud mode (silent fallback) must not compile.
    const badRow: PolicyRow = {
      dataClass: 'RAW',
      mode: 'only_in_cloud',
      tools: [],
      multiTurn: false,
      rationale: 'never valid',
    };
    expect([rawPrefer, badRow.mode]).toHaveLength(2);
  });

  it('rejects at compile time a CONSENTED_RAW row with any mode but ONLY_IN_CLOUD', () => {
    expect(assertType<Equals<AllowedModes<'CONSENTED_RAW'>, 'only_in_cloud'>>(true)).toBe(true);
    expect(assertType<Equals<AllowedModes<'SANITIZED'>, InferenceModeName>>(true)).toBe(true);
    // @ts-expect-error consented raw text may only use ONLY_IN_CLOUD.
    const consentedPrefer: AllowedModes<'CONSENTED_RAW'> = 'prefer_in_cloud';
    // @ts-expect-error a CONSENTED_RAW row must never run on the device or in a hybrid mode.
    const badRow: PolicyRow = {
      dataClass: 'CONSENTED_RAW',
      mode: 'prefer_on_device',
      tools: [],
      multiTurn: false,
      rationale: 'never valid',
    };
    expect([consentedPrefer, badRow.mode]).toHaveLength(2);
  });
});
