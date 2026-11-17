import { describe, expect, it, vi } from 'vitest';
import { getPromptModule } from '../ai/prompts/promptRegistry';
import { STRATEGIES } from '../ai/prompts/strategies';
import { createAppError } from '../shared/appError';
import { err, ok } from '../shared/result';
import type { DeviceModel } from '../infrastructure/ai/deviceCapability';
import { prepareModels, prepareSpecs } from './onDevicePrepare';

const MODEL: DeviceModel = { initializeDeviceModel: () => Promise.resolve() };
const FAILED = createAppError('OnDeviceUnavailable', { message: 'no model' });

describe('prepareSpecs', () => {
  const investigator = {
    groups: STRATEGIES.single,
    prompt: getPromptModule('identityScan.v3-investigator')!,
  };

  it('one scan model per pass, plus the verifier with verify', () => {
    expect(prepareSpecs([investigator], true).map((s) => s.task)).toEqual([
      'identityScan',
      'disclosureVerify',
    ]);
    expect(prepareSpecs([investigator], false).map((s) => s.task)).toEqual(['identityScan']);
  });
});

describe('prepareModels', () => {
  it('reports the mean progress and ends at 1', async () => {
    const progress: number[] = [];
    const chrome = {
      prepare: vi.fn((_model: DeviceModel, onProgress: (f: number) => void) => {
        onProgress(0.5);
        return Promise.resolve(ok(undefined));
      }),
    };
    const result = await prepareModels(chrome, [MODEL, MODEL], (f) => progress.push(f));
    expect(result.ok).toBe(true);
    expect(chrome.prepare).toHaveBeenCalledTimes(2);
    expect(progress.at(0)).toBe(0.25);
    expect(progress.at(-1)).toBe(1);
  });

  it('starts every prepare synchronously, inside the click (before any await)', () => {
    const first: DeviceModel = { initializeDeviceModel: () => Promise.resolve() };
    const second: DeviceModel = { initializeDeviceModel: () => Promise.resolve() };
    const chrome = {
      prepare: vi.fn<(model: DeviceModel, onProgress: (f: number) => void) => Promise<never>>(
        () => new Promise<never>(() => undefined),
      ),
    };
    void prepareModels(chrome, [first, second], () => undefined);
    expect(chrome.prepare).toHaveBeenCalledTimes(2);
    expect(chrome.prepare.mock.calls.map((call) => call[0])).toEqual([first, second]);
  });

  it('answers the first failure', async () => {
    const chrome = {
      prepare: vi.fn().mockResolvedValueOnce(ok(undefined)).mockResolvedValueOnce(err(FAILED)),
    };
    const result = await prepareModels(chrome, [MODEL, MODEL], () => undefined);
    expect(result).toEqual(err(FAILED));
  });
});
