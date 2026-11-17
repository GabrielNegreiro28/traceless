import { describe, expect, it } from 'vitest';
import { toRawText } from '../../domain/text/brandedText';
import {
  buildDisclosureVerifySchema,
  MAX_VERIFY_CANDIDATES,
  parseDisclosureVerifyOutput,
  VERIFY_CATEGORY_LABELS,
} from '../schemas/disclosureVerify';
import { MODEL_FINDING_CATEGORIES } from '../schemas/identityScan';
import {
  buildInitialPrompts,
  buildSystemPrompt,
  buildUserPrompt,
  DISCLOSURE_VERIFY_V1,
} from './disclosureVerify.v1';
import { VERIFY_FEW_SHOTS } from './disclosureVerify.v1.fewShots';

const answer = (...items: object[]) => JSON.stringify({ items });

describe('disclosureVerify.v1 prompt', () => {
  it('defines about, every model category and NONE in a short system prompt', () => {
    const system = buildSystemPrompt();
    for (const label of [...MODEL_FINDING_CATEGORIES, 'NONE']) {
      expect(system).toContain(`- ${label}:`);
    }
    expect(system).toMatch(/WRITER.*OTHER.*UNSURE/);
    expect(Math.ceil(system.length / 4)).toBeLessThan(200);
  });

  it('numbers the phrases after the delimited report, one line each', () => {
    const prompt = buildUserPrompt(toRawText('I run the night kiosk.'), [
      'the night\nkiosk',
      'I run',
    ]);
    expect(prompt).toBe(
      'Report:\n"""\nI run the night kiosk.\n"""\nPhrases:\n1. the night kiosk\n2. I run',
    );
  });

  it('has two few-shot pairs whose answers parse', () => {
    expect(buildInitialPrompts().map((p) => p.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    for (const example of VERIFY_FEW_SHOTS) {
      const parsed = DISCLOSURE_VERIFY_V1.parse(
        answer(...example.items),
        example.candidates.length,
      );
      expect(parsed.ok).toBe(true);
    }
  });
});

describe('disclosureVerify schema and parser', () => {
  it('bounds ids and items and enumerates the labels', () => {
    const schema = buildDisclosureVerifySchema();
    const items = schema.properties?.items as { maxItems: number; items: { properties: object } };
    expect(items.maxItems).toBe(MAX_VERIFY_CANDIDATES);
    expect(JSON.stringify(items.items.properties)).toContain(`"maximum":${MAX_VERIFY_CANDIDATES}`);
    expect(JSON.stringify(schema)).toContain(JSON.stringify([...VERIFY_CATEGORY_LABELS]));
    expect(buildDisclosureVerifySchema()).not.toBe(schema);
  });

  it('maps 1-based ids to 0-based indexes, fenced JSON included', () => {
    const text = '```json\n' + answer({ id: 2, about: 'WRITER', category: 'SCHEDULE' }) + '\n```';
    expect(parseDisclosureVerifyOutput(text, 2)).toEqual({
      ok: true,
      value: [{ index: 1, about: 'WRITER', category: 'SCHEDULE' }],
    });
  });

  it.each([
    ['bad JSON', '{nope', 3],
    ['a missing items array', '{}', 3],
    ['an id above the candidate count', answer({ id: 4, about: 'WRITER', category: 'NONE' }), 3],
    ['an id of zero', answer({ id: 0, about: 'WRITER', category: 'NONE' }), 3],
    ['a fractional id', answer({ id: 1.5, about: 'WRITER', category: 'NONE' }), 3],
    ['an unknown subject', answer({ id: 1, about: 'BOSS', category: 'NONE' }), 3],
    ['WRITING_STYLE', answer({ id: 1, about: 'WRITER', category: 'WRITING_STYLE' }), 3],
  ])('rejects %s as InvalidModelOutput', (_name, text, count) => {
    const parsed = parseDisclosureVerifyOutput(text, count);
    expect(!parsed.ok && parsed.error.kind).toBe('InvalidModelOutput');
    expect(!parsed.ok && parsed.error.message).not.toContain('BOSS');
  });
});
