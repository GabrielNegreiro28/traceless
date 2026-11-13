import { AIError, AIErrorCode } from 'firebase/ai';
import { describe, expect, it } from 'vitest';
import type { AppErrorKind } from '../../shared/appError';
import { mapAiError } from './errorMapper';

const SDK_TEXT = 'I am the only night nurse on ward 7';

describe('mapAiError', () => {
  it.each<[string, unknown, AppErrorKind]>([
    [
      'AIError api-not-enabled',
      new AIError(AIErrorCode.API_NOT_ENABLED, SDK_TEXT),
      'OnDeviceUnavailable',
    ],
    ['AIError unsupported', new AIError(AIErrorCode.UNSUPPORTED, SDK_TEXT), 'OnDeviceUnavailable'],
    ['AIError fetch-error', new AIError(AIErrorCode.FETCH_ERROR, SDK_TEXT), 'Offline'],
    ['AIError error', new AIError(AIErrorCode.ERROR, SDK_TEXT), 'Unknown'],
    ['AIError invalid-content', new AIError(AIErrorCode.INVALID_CONTENT, SDK_TEXT), 'Unknown'],
    [
      'DOMException NotAllowedError',
      new DOMException(SDK_TEXT, 'NotAllowedError'),
      'OnDeviceUnavailable',
    ],
    [
      'DOMException InvalidStateError',
      new DOMException(SDK_TEXT, 'InvalidStateError'),
      'OnDeviceUnavailable',
    ],
    [
      'DOMException NotSupportedError',
      new DOMException(SDK_TEXT, 'NotSupportedError'),
      'LanguageNotSupported',
    ],
    ['DOMException AbortError', new DOMException(SDK_TEXT, 'AbortError'), 'Unknown'],
    [
      'DOMException named like a prototype key',
      new DOMException(SDK_TEXT, 'constructor'),
      'Unknown',
    ],
    [
      'plain Error named NotSupportedError',
      Object.assign(new Error(SDK_TEXT), { name: 'NotSupportedError' }),
      'Unknown',
    ],
    ['a string', SDK_TEXT, 'Unknown'],
    ['null', null, 'Unknown'],
    ['undefined', undefined, 'Unknown'],
  ])('maps %s to %s', (_, error, kind) => {
    expect(mapAiError(error).kind).toBe(kind);
  });

  it('marks a rejected language as undetermined', () => {
    const mapped = mapAiError(new DOMException(SDK_TEXT, 'NotSupportedError'));
    expect(mapped).toMatchObject({ kind: 'LanguageNotSupported', language: 'und' });
  });

  it.each([
    new AIError(AIErrorCode.API_NOT_ENABLED, SDK_TEXT),
    new AIError(AIErrorCode.FETCH_ERROR, SDK_TEXT),
    new DOMException(SDK_TEXT, 'NotSupportedError'),
    new Error(SDK_TEXT),
  ])('never copies SDK text or attaches the original error (%#)', (error) => {
    const mapped = mapAiError(error);
    expect(mapped.message).not.toContain('night nurse');
    expect(mapped).not.toHaveProperty('cause');
  });
});
