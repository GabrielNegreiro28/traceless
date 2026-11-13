import { describe, expect, it } from 'vitest';
import { onDeviceTextOptions, readLanguageModel } from './languageModelGlobal';

describe('onDeviceTextOptions', () => {
  it('declares text-only English input and output', () => {
    expect(onDeviceTextOptions()).toEqual({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
  });

  it('returns fresh objects on every call', () => {
    const a = onDeviceTextOptions();
    const b = onDeviceTextOptions();
    expect(a.expectedInputs).not.toBe(b.expectedInputs);
    expect(a.expectedOutputs[0]).not.toBe(b.expectedOutputs[0]);
    expect(a.expectedOutputs[0]?.languages).not.toBe(b.expectedOutputs[0]?.languages);
  });
});

describe('readLanguageModel', () => {
  const availability = () => Promise.resolve('available');

  it('returns undefined when the global is missing', () => {
    expect(readLanguageModel({})).toBeUndefined();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an object without availability()', {}],
    ['a string', 'LanguageModel'],
  ])('returns undefined when the global is %s', (_, value) => {
    expect(readLanguageModel({ LanguageModel: value })).toBeUndefined();
  });

  it('accepts an object or a class with a static availability()', () => {
    const asObject = { availability };
    class LanguageModel {
      static availability = availability;
    }
    expect(readLanguageModel({ LanguageModel: asObject })).toBe(asObject);
    expect(readLanguageModel({ LanguageModel })).toBe(LanguageModel);
  });

  it('reads globalThis by default (jsdom has no Prompt API)', () => {
    expect(readLanguageModel()).toBeUndefined();
  });
});
