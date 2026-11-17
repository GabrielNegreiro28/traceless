import { describe, expect, it, vi } from 'vitest';
import { SHIPPED_SCAN_PIPELINE, scanPassesOf, v3Pipeline } from '../ai/prompts/scanPipelines';
import { toRawText } from '../domain/text/brandedText';
import { ok } from '../shared/result';
import { createLazyCandidateFinder } from './lazyCandidateFinder';
import { resolveScanSetups, variantKey } from './scanBinding';

describe('scan pipeline passes', () => {
  it('an existing spec has exactly its primary pass and no verifier', () => {
    expect(scanPassesOf(SHIPPED_SCAN_PIPELINE)).toEqual([
      { promptVersion: 'identityScan.v2', strategy: 'single2' },
    ]);
    expect(SHIPPED_SCAN_PIPELINE).not.toHaveProperty('extraScans');
    expect(SHIPPED_SCAN_PIPELINE).not.toHaveProperty('verify');
    const setups = resolveScanSetups(SHIPPED_SCAN_PIPELINE);
    expect(setups.map((s) => [s.prompt.version, s.groups.length])).toEqual([
      ['identityScan.v2', 2],
    ]);
  });

  it('resolves the round-3 passes in order', () => {
    const versions = (base: boolean, verify: boolean) =>
      resolveScanSetups(v3Pipeline({ base, verify })).map((s) => s.prompt.version);
    expect(versions(true, false)).toEqual(['identityScan.v2', 'identityScan.v3-investigator']);
    expect(versions(false, true)).toEqual(['identityScan.v3-investigator']);
    expect(versions(true, true)).toEqual(['identityScan.v2', 'identityScan.v3-investigator']);
    expect(v3Pipeline({ base: false, verify: true }).verify).toBe(true);
    expect(v3Pipeline({ base: true, verify: false })).not.toHaveProperty('verify');
  });

  it('throws on an unregistered prompt version', () => {
    const broken = {
      ...SHIPPED_SCAN_PIPELINE,
      extraScans: [{ promptVersion: 'nope', strategy: 'single' as const }],
    };
    expect(() => resolveScanSetups(broken)).toThrow('Unknown prompt version: nope');
  });

  it('gives every pipeline its own cache key', () => {
    const keys = [
      SHIPPED_SCAN_PIPELINE,
      v3Pipeline({ base: true, verify: false }),
      v3Pipeline({ base: false, verify: true }),
      v3Pipeline({ base: true, verify: true }),
    ].map(variantKey);
    expect(new Set(keys).size).toBe(4);
  });
});

describe('createLazyCandidateFinder', () => {
  const TEXT = toRawText('I mop the atrium at dawn.');

  it('loads the Layer-2 module only on the first find, then reuses it', async () => {
    const find = vi.fn(() => Promise.resolve(ok([])));
    const load = vi.fn(() => Promise.resolve({ find }));
    const finder = createLazyCandidateFinder(load);
    expect(load).not.toHaveBeenCalled();
    await finder.find(TEXT);
    await finder.find(TEXT);
    expect(load).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('answers an error when the module fails to load, and retries next time', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce({ find: () => Promise.resolve(ok([])) });
    const finder = createLazyCandidateFinder(load);
    const failed = await finder.find(TEXT);
    expect(!failed.ok && failed.error.kind).toBe('Unknown');
    expect(await finder.find(TEXT)).toEqual(ok([]));
  });
});
