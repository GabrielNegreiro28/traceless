import { AIError, AIErrorCode, type GenerateContentResponse } from 'firebase/ai';
import { describe, expect, it } from 'vitest';
import { mapCloudAiError } from './cloudErrorMapper';

const SECRET = 'I am the only night nurse on ward 7';

function responseError(response: GenerateContentResponse): AIError {
  return new AIError(AIErrorCode.RESPONSE_ERROR, `Response error: ${SECRET}`, { response });
}

function fetchError(status: number): AIError {
  return new AIError(AIErrorCode.FETCH_ERROR, `Error fetching: ${SECRET}`, { status });
}

describe('mapCloudAiError', () => {
  it.each<[string, GenerateContentResponse]>([
    ['a blocked prompt', { promptFeedback: { blockReason: 'SAFETY', safetyRatings: [] } }],
    [
      'a prohibited prompt',
      { promptFeedback: { blockReason: 'PROHIBITED_CONTENT', safetyRatings: [] } },
    ],
    [
      'a safety-stopped answer',
      { candidates: [{ index: 0, content: { role: 'model', parts: [] }, finishReason: 'SAFETY' }] },
    ],
    [
      'an SPII-stopped answer',
      { candidates: [{ index: 0, content: { role: 'model', parts: [] }, finishReason: 'SPII' }] },
    ],
  ])('maps %s to ContentBlocked', (_name, response) => {
    expect(mapCloudAiError(responseError(response)).kind).toBe('ContentBlocked');
  });

  it('maps a response error without a block signal to InvalidModelOutput', () => {
    const response: GenerateContentResponse = {
      candidates: [
        { index: 0, content: { role: 'model', parts: [] }, finishReason: 'MALFORMED_RESPONSE' },
      ],
    };
    expect(mapCloudAiError(responseError(response)).kind).toBe('InvalidModelOutput');
    expect(mapCloudAiError(new AIError(AIErrorCode.RESPONSE_ERROR, 'x')).kind).toBe(
      'InvalidModelOutput',
    );
  });

  it.each([
    [429, 'QuotaExceeded'],
    [401, 'PermissionDenied'],
    [403, 'PermissionDenied'],
    [500, 'Unknown'],
  ])('maps HTTP %d to %s', (status, kind) => {
    expect(mapCloudAiError(fetchError(status)).kind).toBe(kind);
  });

  it('maps network failures and timeouts to Offline', () => {
    expect(mapCloudAiError(new AIError(AIErrorCode.ERROR, 'Error fetching')).kind).toBe('Offline');
    expect(mapCloudAiError(new TypeError('Failed to fetch')).kind).toBe('Offline');
    expect(mapCloudAiError(new DOMException('timeout', 'AbortError')).kind).toBe('Offline');
    expect(mapCloudAiError(new DOMException('timeout', 'TimeoutError')).kind).toBe('Offline');
  });

  it('maps anything else to Unknown', () => {
    expect(mapCloudAiError(new AIError(AIErrorCode.API_NOT_ENABLED, 'x')).kind).toBe('Unknown');
    expect(mapCloudAiError(new AIError(AIErrorCode.INVALID_SCHEMA, 'x')).kind).toBe('Unknown');
    expect(mapCloudAiError('boom').kind).toBe('Unknown');
  });

  it('never copies SDK messages (they can echo request content) or attaches a cause', () => {
    const errors = [
      responseError({ promptFeedback: { blockReason: 'SAFETY', safetyRatings: [] } }),
      fetchError(429),
      fetchError(500),
      new AIError(AIErrorCode.ERROR, SECRET),
      new TypeError(SECRET),
    ];
    for (const error of errors) {
      const mapped = mapCloudAiError(error);
      expect(mapped.message).not.toContain('night nurse');
      expect(mapped.cause).toBeUndefined();
    }
  });
});
