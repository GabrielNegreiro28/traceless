import { describe, expect, it, vi } from 'vitest';
import { buildUserPrompt } from '../../../ai/prompts/identityScan.v1';
import { getPromptModule } from '../../../ai/prompts/promptRegistry';
import { STRATEGIES } from '../../../ai/prompts/strategies';
import type { ModelFindingCategory } from '../../../ai/schemas/identityScan';
import { toRawText, type RawText } from '../../../domain/text/brandedText';
import { createAppError, type AppError } from '../../../shared/appError';
import { err, ok } from '../../../shared/result';
import type { PromptRunner } from '../onDevicePromptRunner';
import { OnDeviceIdentityScanner, type ScanPrompt } from './OnDeviceIdentityScanner';

const V1 = getPromptModule('identityScan.v1')!;
const V2 = getPromptModule('identityScan.v2')!;

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

function findingsJson(...items: [string, string][]): string {
  return JSON.stringify({
    findings: items.map(([quote, category]) => ({ quote, category, reason: 'r', suggestion: '' })),
  });
}

function singleGroupScanner(steps: readonly Step[], prompt: ScanPrompt = V1) {
  const scripted = scriptedRunner(steps);
  return {
    ...scripted,
    scanner: new OnDeviceIdentityScanner(STRATEGIES.single, () => scripted.runner, prompt),
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
        protectedQuotes: [],
        source: 'ON_DEVICE',
        retries: 0,
      }),
    );
    expect(prompts).toEqual([buildUserPrompt(CHUNK)]);
  });

  it('uses the injected prompt builder and parser', async () => {
    const parse = vi.fn(V1.parse);
    const stub: ScanPrompt = { buildUserPrompt: () => toRawText('STUB PROMPT'), parse };
    const { scanner, prompts } = singleGroupScanner([{ text: findingsJson() }], stub);
    await scanner.scan(CHUNK);
    expect(prompts).toEqual(['STUB PROMPT']);
    expect(parse).toHaveBeenCalledWith('{"findings":[]}', STRATEGIES.single[0]);
  });

  it('v1 drops outlet items; v2 turns them into protected quotes', async () => {
    const json = findingsJson(['the head nurse', 'REPORTED_PERSON'], ['ward 7', 'LOCATION']);
    const v1 = await singleGroupScanner([{ text: json }]).scanner.scan(CHUNK);
    const v2 = await singleGroupScanner([{ text: json }], V2).scanner.scan(CHUNK);
    if (!v1.ok || !v2.ok) throw new Error('scan failed');
    expect(v1.value.protectedQuotes).toEqual([]);
    expect(v2.value.protectedQuotes).toEqual(['the head nurse']);
    expect(v2.value.findings.map((f) => f.quote)).toEqual(['ward 7']);
  });

  it('unions protected quotes across passes without duplicates', async () => {
    const first = scriptedRunner([{ text: findingsJson(['Dr. Ames', 'REPORTED_PERSON']) }]);
    const second = scriptedRunner([
      { text: findingsJson(['Dr. Ames', 'REPORTED_PERSON'], ['a porter', 'OTHER_PERSON']) },
    ]);
    const runners = [first.runner, second.runner];
    const scanner = new OnDeviceIdentityScanner(STRATEGIES.single2, () => runners.shift()!, V2);
    const result = await scanner.scan(CHUNK);
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.protectedQuotes).toEqual(['Dr. Ames', 'a porter']);
    expect(first.prompts).toHaveLength(1);
    expect(second.prompts).toHaveLength(1);
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
    const scanner = new OnDeviceIdentityScanner(STRATEGIES.grouped2, runnerFor, V1);
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
    const scanner = new OnDeviceIdentityScanner(STRATEGIES.grouped2, () => runners.shift()!, V1);
    await expect(scanner.scan(CHUNK)).resolves.toEqual(err(failure));
    expect(second.prompts).toEqual([]);
  });
});
