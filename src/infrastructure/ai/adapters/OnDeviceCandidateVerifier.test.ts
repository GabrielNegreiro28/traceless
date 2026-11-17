import { describe, expect, it, vi } from 'vitest';
import { policyFor } from '../../../ai/policy/inferencePolicy';
import { DISCLOSURE_VERIFY_V1, buildUserPrompt } from '../../../ai/prompts/disclosureVerify.v1';
import { toRawText, type RawText } from '../../../domain/text/brandedText';
import { createAppError, type AppError } from '../../../shared/appError';
import { err, ok } from '../../../shared/result';
import { onDeviceModelConfig } from '../modelFactory';
import type { PromptRunner } from '../onDevicePromptRunner';
import { disclosureVerifyModelSpec } from './disclosureVerifyModelSpec';
import { OnDeviceCandidateVerifier } from './OnDeviceCandidateVerifier';

const CHUNK = toRawText('I am the only diver on the dam crew. The foreman sells the spare cable.');
const CANDIDATES = ['the only diver on the dam crew', 'sells the spare cable'];

type Step = { readonly text: string } | { readonly error: AppError };

function scriptedRunner(steps: readonly Step[]) {
  const prompts: RawText[] = [];
  const run = vi.fn((prompt: RawText) => {
    const step = steps[prompts.length] ?? { text: '{"items":[]}' };
    prompts.push(prompt);
    return Promise.resolve(
      'error' in step ? err(step.error) : ok({ text: step.text, source: 'ON_DEVICE' as const }),
    );
  });
  const runner: PromptRunner = { run };
  return { run, prompts, verifier: new OnDeviceCandidateVerifier(runner, DISCLOSURE_VERIFY_V1) };
}

const items = (...list: object[]) => ({ text: JSON.stringify({ items: list }) });
const WRITER_ROLE = { id: 1, about: 'WRITER', category: 'ROLE_UNIQUE' };
const OTHER_NONE = { id: 2, about: 'OTHER', category: 'NONE' };

describe('OnDeviceCandidateVerifier', () => {
  it('sends one numbered prompt per chunk and returns 0-based verdicts', async () => {
    const { verifier, prompts } = scriptedRunner([items(WRITER_ROLE, OTHER_NONE)]);
    const result = await verifier.verify(CHUNK, CANDIDATES);
    expect(result).toEqual(
      ok({
        verdicts: [
          { index: 0, about: 'WRITER', category: 'ROLE_UNIQUE' },
          { index: 1, about: 'OTHER', category: 'NONE' },
        ],
        source: 'ON_DEVICE',
        retries: 0,
      }),
    );
    expect(prompts).toEqual([buildUserPrompt(CHUNK, CANDIDATES)]);
  });

  it('retries once on invalid output, then succeeds', async () => {
    const { verifier, prompts } = scriptedRunner([{ text: 'not json' }, items(WRITER_ROLE)]);
    const result = await verifier.verify(CHUNK, CANDIDATES);
    expect(result.ok && result.value.retries).toBe(1);
    expect(result.ok && result.value.verdicts).toHaveLength(1);
    expect(prompts).toHaveLength(2);
  });

  it('treats an out-of-range id as invalid output (retried, then nothing)', async () => {
    const outOfRange = items({ id: 3, about: 'WRITER', category: 'SCHEDULE' });
    const { verifier, prompts } = scriptedRunner([outOfRange, outOfRange]);
    const result = await verifier.verify(CHUNK, CANDIDATES);
    expect(result).toEqual(ok({ verdicts: [], source: 'ON_DEVICE', retries: 1 }));
    expect(prompts).toHaveLength(2);
  });

  it('contributes nothing when the output stays invalid (never more than one retry)', async () => {
    const { verifier, prompts } = scriptedRunner([
      { text: '{}' },
      { text: '[1]' },
      items(WRITER_ROLE),
    ]);
    expect(await verifier.verify(CHUNK, CANDIDATES)).toEqual(
      ok({ verdicts: [], source: 'ON_DEVICE', retries: 1 }),
    );
    expect(prompts).toHaveLength(2);
  });

  it('fails the call on a runner failure (stall), without retrying', async () => {
    const stuck = createAppError('OnDeviceStuck', { message: 'stalled', recoverable: true });
    const { verifier, prompts } = scriptedRunner([{ error: stuck }]);
    expect(await verifier.verify(CHUNK, CANDIDATES)).toEqual(err(stuck));
    expect(prompts).toHaveLength(1);
  });

  it('makes no call without candidates', async () => {
    const { verifier, run } = scriptedRunner([]);
    expect(await verifier.verify(CHUNK, [])).toEqual(
      ok({ verdicts: [], source: 'ON_DEVICE', retries: 0 }),
    );
    expect(run).not.toHaveBeenCalled();
  });
});

describe('disclosureVerifyModelSpec', () => {
  it('is the RAW, on-device-only verifier task with English inputs and outputs', () => {
    const spec = disclosureVerifyModelSpec(DISCLOSURE_VERIFY_V1);
    expect(spec.task).toBe('disclosureVerify');
    expect(policyFor(spec.task)).toMatchObject({ dataClass: 'RAW', mode: 'only_on_device' });
    expect(spec.initialPrompts).toEqual(DISCLOSURE_VERIFY_V1.buildInitialPrompts());
    expect(spec.responseConstraint).toEqual(DISCLOSURE_VERIFY_V1.buildSchema());
    const { params, requestOptions } = onDeviceModelConfig(spec, new AbortController().signal);
    expect(params.mode).toBe('only_on_device');
    expect(params.onDeviceParams?.createOptions).toMatchObject({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
    expect(requestOptions.baseUrl).toBe('https://on-device-only.invalid');
  });
});
