import { AIError, AIErrorCode, FinishReason, type GenerateContentResponse } from 'firebase/ai';
import { createAppError, type AppError } from '../../shared/appError';

/**
 * Maps exceptions from a CLOUD Firebase AI Logic call to AppError (the on-device mapper,
 * errorMapper.ts, reads the same SDK codes differently). Messages are FIXED strings: SDK
 * messages are never copied and the error is never attached as `cause`, because a cloud
 * error can echo request content. Only the HTTP status number may appear in a message.
 */

const BLOCKED = createAppError('ContentBlocked', {
  message: 'The cloud model refused this request (safety filters).',
});
const NO_ANSWER = createAppError('InvalidModelOutput', {
  message: 'The cloud model returned no usable answer (response-error).',
});
const QUOTA = createAppError('QuotaExceeded', {
  message: 'The cloud AI usage limit was reached (HTTP 429).',
});
const DENIED = createAppError('PermissionDenied', {
  message: 'The cloud AI refused the request (HTTP 401/403, for example App Check).',
});
const OFFLINE = createAppError('Offline', { message: 'The cloud AI could not be reached.' });
const TIMED_OUT = createAppError('Offline', { message: 'The cloud AI request timed out.' });
const NOT_ENABLED = createAppError('Unknown', {
  message: 'Firebase AI Logic is not enabled for this project (api-not-enabled).',
});
const UNKNOWN = createAppError('Unknown', { message: 'Unexpected cloud AI error.' });

/** Finish reasons that mean a filter stopped the answer (not a malformed one). */
const BLOCKING_FINISH_REASONS: readonly string[] = [
  FinishReason.SAFETY,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
];

/** A blocked prompt has a `blockReason`; a blocked answer a blocking finish reason. */
function isBlocked(response: GenerateContentResponse | undefined): boolean {
  if (response === undefined) return false;
  if (response.promptFeedback?.blockReason !== undefined) return true;
  const reason = response.candidates?.[0]?.finishReason;
  return reason !== undefined && BLOCKING_FINISH_REASONS.includes(reason);
}

function fromStatus(status: number | undefined): AppError {
  if (status === 429) return QUOTA;
  if (status === 401 || status === 403) return DENIED;
  const code = status === undefined ? 'unknown' : String(status);
  return createAppError('Unknown', { message: `The cloud AI returned an error (HTTP ${code}).` });
}

function fromSdk(error: AIError): AppError {
  switch (error.code) {
    case AIErrorCode.RESPONSE_ERROR:
      return isBlocked(error.customErrorData?.response) ? BLOCKED : NO_ANSWER;
    case AIErrorCode.FETCH_ERROR:
      return fromStatus(error.customErrorData?.status);
    case AIErrorCode.ERROR:
      // The SDK wraps a failed fetch (no network, DNS, CSP) as a generic `error`.
      return OFFLINE;
    case AIErrorCode.API_NOT_ENABLED:
      return NOT_ENABLED;
    default:
      return UNKNOWN;
  }
}

export function mapCloudAiError(error: unknown): AppError {
  if (error instanceof AIError) return fromSdk(error);
  if (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name)) {
    return TIMED_OUT;
  }
  if (error instanceof TypeError) return OFFLINE;
  return UNKNOWN;
}
