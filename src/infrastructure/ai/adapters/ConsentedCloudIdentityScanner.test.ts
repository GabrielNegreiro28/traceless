import { AIError, AIErrorCode, InferenceSource } from 'firebase/ai';
import { describe, expect, it } from 'vitest';
import { getPromptModule } from '../../../ai/prompts/promptRegistry';
import { STRATEGIES } from '../../../ai/prompts/strategies';
import type { ModelFindingCategory } from '../../../ai/schemas/identityScan';
import type { ConsentedRawText } from '../../../domain/text/brandedText';
import { err, ok } from '../../../shared/result';
import { createConsentedCloudRunner, type ConsentedPromptableModel } from '../consentedCloudRunner';
import { consentedText } from '../consentedText.testKit';
import type { TransientRetryOptions } from '../transientRetry';
import { ConsentedCloudIdentityScanner } from './ConsentedCloudIdentityScanner';

const V2 = getPromptModule('identityScan.v2')!;
const NO_WAIT: TransientRetryOptions = { delaysMs: [600, 1_500], sleep: () => Promise.resolve() };
const CHUNK = consentedText('I am the only night nurse on ward 7. Dr. Hale signs the logs.');

type Answer =
  { readonly text: string; readonly source?: InferenceSource } | { readonly throws: unknown };

/** A fake cloud model that plays scripted answers and records every chunk it is sent. */
function fakeModel(answers: readonly Answer[]) {
  const chunks: ConsentedRawText[] = [];
  const model: ConsentedPromptableModel = {
    generateContent: (chunk) => {
      const answer = answers[chunks.length] ?? { text: '{"findings":[]}' };
      chunks.push(chunk);
      if ('throws' in answer)
        return (async () => {
          await Promise.resolve();
          throw answer.throws;
        })();
      const inferenceSource = answer.source ?? InferenceSource.IN_CLOUD;
      return Promise.resolve({ response: { inferenceSource, text: () => answer.text } });
    },
  };
  return { model, chunks };
}

type Groups = readonly (readonly ModelFindingCategory[])[];

function scannerOver(answers: readonly Answer[], groups: Groups = STRATEGIES.single2) {
  const fake = fakeModel(answers);
  const runner = createConsentedCloudRunner(() => ok(fake.model));
  return { ...fake, scanner: new ConsentedCloudIdentityScanner(groups, () => runner, V2.parse) };
}

const json = (...items: [string, string][]) =>
  JSON.stringify({
    findings: items.map(([quote, category]) => ({ quote, category, reason: 'r', suggestion: '' })),
  });

describe('ConsentedCloudIdentityScanner (fake model)', () => {
  it('parses schema-valid output with the shared v2 parser, across the single2 passes', async () => {
    const { scanner, chunks } = scannerOver([
      { text: json(['only night nurse', 'ROLE_UNIQUE'], ['Dr. Hale', 'REPORTED_PERSON']) },
      { text: json(['ward 7', 'LOCATION'], ['only night nurse', 'ROLE_UNIQUE']) },
    ]);
    const result = await scanner.scan(CHUNK);
    expect(result).toEqual(
      ok({
        findings: [
          { quote: 'only night nurse', category: 'ROLE_UNIQUE', reason: 'r', suggestion: null },
          { quote: 'ward 7', category: 'LOCATION', reason: 'r', suggestion: null },
        ],
        protectedQuotes: ['Dr. Hale'],
        source: 'IN_CLOUD',
        retries: 0,
      }),
    );
    expect(chunks).toEqual([CHUNK, CHUNK]);
  });

  it('salvages valid items and drops invalid ones, exactly as on the device', async () => {
    const mixed = JSON.stringify({
      findings: [
        { quote: 'only night nurse', category: 'ROLE_UNIQUE', reason: 'r', suggestion: '' },
        { quote: 'ward 7', category: 'NOT_A_CATEGORY', reason: 'r', suggestion: '' },
        { quote: '', category: 'LOCATION', reason: 'r', suggestion: '' },
      ],
    });
    const { scanner } = scannerOver([{ text: mixed }], STRATEGIES.single);
    const result = await scanner.scan(CHUNK);
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.findings.map((f) => f.quote)).toEqual(['only night nurse']);
  });

  it('retries invalid output once, then rejects it as InvalidModelOutput', async () => {
    const retried = scannerOver([{ text: 'not json' }, { text: json() }], STRATEGIES.single);
    expect(await retried.scanner.scan(CHUNK)).toMatchObject({ ok: true, value: { retries: 1 } });
    const failed = scannerOver([{ text: 'not json' }, { text: '{"nope":1}' }], STRATEGIES.single);
    expect(await failed.scanner.scan(CHUNK)).toMatchObject({
      ok: false,
      error: { kind: 'InvalidModelOutput' },
    });
    expect(failed.chunks).toHaveLength(2);
  });

  it('maps a safety block raised by text() to ContentBlocked and stops the chunk', async () => {
    const blocked = new AIError(AIErrorCode.RESPONSE_ERROR, 'Text not available.', {
      response: { promptFeedback: { blockReason: 'SAFETY', safetyRatings: [] } },
    });
    const { scanner, chunks } = scannerOver([{ throws: blocked }]);
    expect(await scanner.scan(CHUNK)).toMatchObject({
      ok: false,
      error: { kind: 'ContentBlocked' },
    });
    expect(chunks).toHaveLength(1);
  });

  it.each([
    [new AIError(AIErrorCode.FETCH_ERROR, 'x', { status: 429 }), 'QuotaExceeded'],
    [new AIError(AIErrorCode.FETCH_ERROR, 'x', { status: 403 }), 'PermissionDenied'],
    [new AIError(AIErrorCode.ERROR, 'Error fetching'), 'Offline'],
    [new Error('boom'), 'Unknown'],
  ])('maps a failed call (%s) to an AppError', async (thrown, kind) => {
    const { scanner } = scannerOver([{ throws: thrown }]);
    expect(await scanner.scan(CHUNK)).toMatchObject({ ok: false, error: { kind } });
  });

  it('reports the source from the SDK, never assumed', async () => {
    const { scanner } = scannerOver(
      [{ text: json(), source: InferenceSource.ON_DEVICE }],
      STRATEGIES.single,
    );
    expect(await scanner.scan(CHUNK)).toMatchObject({ ok: true, value: { source: 'ON_DEVICE' } });
  });

  it('creates the model once, and a failed creation fails the chunk', async () => {
    let created = 0;
    const fake = fakeModel([]);
    const runner = createConsentedCloudRunner(() => {
      created += 1;
      return ok(fake.model);
    });
    const scanner = new ConsentedCloudIdentityScanner(STRATEGIES.single2, () => runner, V2.parse);
    await scanner.scan(CHUNK);
    await scanner.scan(CHUNK);
    expect(created).toBe(1);

    const failing = createConsentedCloudRunner(() =>
      err({ kind: 'Offline', message: 'no network' }),
    );
    const broken = new ConsentedCloudIdentityScanner(STRATEGIES.single, () => failing, V2.parse);
    expect(await broken.scan(CHUNK)).toMatchObject({ ok: false, error: { kind: 'Offline' } });
  });

  it('retries a transient HTTP 500 and completes the scan (regression: one 500 ended it)', async () => {
    const http500 = new AIError(AIErrorCode.FETCH_ERROR, 'x', { status: 500 });
    const fake = fakeModel([{ throws: http500 }, { text: json(['ward 7', 'LOCATION']) }]);
    const runner = createConsentedCloudRunner(() => ok(fake.model), NO_WAIT);
    const scanner = new ConsentedCloudIdentityScanner(STRATEGIES.single, () => runner, V2.parse);
    const result = await scanner.scan(CHUNK);
    expect(result).toMatchObject({ ok: true, value: { findings: [{ quote: 'ward 7' }] } });
    expect(fake.chunks).toHaveLength(2);
  });

  it('stops retrying once the scan is cancelled', async () => {
    const http503 = new AIError(AIErrorCode.FETCH_ERROR, 'x', { status: 503 });
    const fake = fakeModel([{ throws: http503 }, { text: json() }]);
    const runner = createConsentedCloudRunner(() => ok(fake.model), NO_WAIT);
    const scanner = new ConsentedCloudIdentityScanner(STRATEGIES.single, () => runner, V2.parse);
    const result = await scanner.scan(CHUNK, () => true);
    expect(result).toMatchObject({ ok: false, error: { kind: 'Unknown' } });
    expect(fake.chunks).toHaveLength(1);
  });
});
