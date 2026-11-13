import { describe, expect, it, vi } from 'vitest';
import { buildUserPrompt, STRATEGIES } from '../../../ai/prompts/identityScan.v1';
import type { ModelFindingCategory } from '../../../ai/schemas/identityScan';
import { toRawText, type RawText } from '../../../domain/text/brandedText';
import { createAppError, type AppError } from '../../../shared/appError';
import { err, ok } from '../../../shared/result';
import type { PromptRunner } from '../onDevicePromptRunner';
import { OnDeviceIdentityScanner } from './OnDeviceIdentityScanner';

const CHUNK = toRawText('I am the only night nurse on ward 7. I sit at desk 14.');

type Step = { readonly text: string } | { readonly error: AppError };

/** Runner that plays scripted outputs and records every prompt it receives. */
function scriptedRunner(steps: readonly Step[]) {
  const prompts: RawText[] = [];
  const runner: PromptRunner = {
    run: vi.fn((prompt: RawText) => {
      const step = steps[prompts.length] ?? { text: '{"findings":[]}' };
      prompts.push(prompt);
      return Promise.resolve(
        'error' in step ? err(step.error) : ok({ text: step.text, source: 'ON_DEVICE' as const }),
      );
    }),
  };
  return { runner, prompts };
}

function findingsJson(...items: [string, ModelFindingCategory][]): string {
  return JSON.stringify({
    findings: items.map(([quote, category]) => ({ quote, category, reason: 'r', suggestion: '' })),
  });
}

function singleGroupScanner(steps: readonly Step[]) {
  const scripted = scriptedRunner(steps);
  return {
    ...scripted,
    scanner: new OnDeviceIdentityScanner(STRATEGIES.single, () => scripted.runner),
  };
}

describe('OnDeviceIdentityScanner', () => {
  it('sends the delimited user prompt and returns validated on-device findings', async () => {
    const { scanner, prompts } = singleGroupScanner([
      { text: findingsJson(['only night nurse', 'ROLE_UNIQUE']) },
    ]);
    const result = await scanner.scan(CHUNK);
    expect(result).toEqual(
      ok({
        findings: [
          { quote: 'only night nurse', category: 'ROLE_UNIQUE', reason: 'r', suggestion: null },
        ],
        source: 'ON_DEVICE',
        retries: 0,
      }),
    );
    expect(prompts).toEqual([buildUserPrompt(CHUNK)]);
  });

  it('retries once on invalid JSON, then succeeds', async () => {
    const { scanner, prompts } = singleGroupScanner([
      { text: 'Sure! Here are the findings:' },
      { text: findingsJson(['desk 14', 'LOCATION']) },
    ]);
    const result = await scanner.scan(CHUNK);
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.retries).toBe(1);
    expect(result.value.findings.map((f) => f.quote)).toEqual(['desk 14']);
    expect(prompts).toEqual([buildUserPrompt(CHUNK), buildUserPrompt(CHUNK)]);
  });

  it('fails with InvalidModelOutput after one retry, without a third call', async () => {
    const { scanner, prompts } = singleGroupScanner([
      { text: 'not json' },
      { text: '{"items":[]}' },
    ]);
    const result = await scanner.scan(CHUNK);
    expect(!result.ok && result.error.kind).toBe('InvalidModelOutput');
    expect(prompts).toHaveLength(2);
  });

  it('never retries a runner failure such as a privacy violation', async () => {
    const violation = createAppError('PrivacyViolation', { message: 'discarded' });
    const { scanner, prompts } = singleGroupScanner([{ error: violation }]);
    await expect(scanner.scan(CHUNK)).resolves.toEqual(err(violation));
    expect(prompts).toHaveLength(1);
  });

  it('runs one call per group, each validated against its own categories, and unions them', async () => {
    const [people, places] = STRATEGIES.grouped2;
    const byGroup = new Map<readonly ModelFindingCategory[], ReturnType<typeof scriptedRunner>>([
      [
        people,
        scriptedRunner([
          { text: findingsJson(['only night nurse', 'ROLE_UNIQUE'], ['desk 14', 'LOCATION']) },
        ]),
      ],
      [
        places,
        scriptedRunner([{ text: findingsJson(['desk 14', 'LOCATION'], ['desk 14', 'LOCATION']) }]),
      ],
    ]);
    const runnerFor = vi.fn((group: readonly ModelFindingCategory[]) => byGroup.get(group)!.runner);
    const scanner = new OnDeviceIdentityScanner(STRATEGIES.grouped2, runnerFor);
    const result = await scanner.scan(CHUNK);
    if (!result.ok) throw new Error(result.error.kind);
    // LOCATION is outside the first group, so its copy there is dropped; duplicates collapse.
    expect(result.value.findings.map((f) => [f.quote, f.category])).toEqual([
      ['only night nurse', 'ROLE_UNIQUE'],
      ['desk 14', 'LOCATION'],
    ]);
    expect(runnerFor).toHaveBeenCalledTimes(2);
    expect(byGroup.get(people)!.prompts).toHaveLength(1);
    expect(byGroup.get(places)!.prompts).toHaveLength(1);
  });

  it('stops at the first failing group', async () => {
    const failure = createAppError('OnDeviceUnavailable', { message: 'gone' });
    const first = scriptedRunner([{ error: failure }]);
    const second = scriptedRunner([]);
    const runners = [first.runner, second.runner];
    const scanner = new OnDeviceIdentityScanner(STRATEGIES.grouped2, () => runners.shift()!);
    await expect(scanner.scan(CHUNK)).resolves.toEqual(err(failure));
    expect(second.prompts).toEqual([]);
  });
});
