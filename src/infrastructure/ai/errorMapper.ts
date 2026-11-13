import { AIError, AIErrorCode } from 'firebase/ai';
import { createAppError, type AppError } from '../../shared/appError';

/**
 * Maps SDK and Chrome Prompt API exceptions to AppError (docs/design/fase2-ai-layer.md §3).
 *
 * Messages are FIXED strings chosen here: SDK/browser messages are never copied and
 * the original error is not attached as `cause`, because a cloud error message can echo
 * request content. Each message names the matched code so failures stay debuggable.
 */

const AI_ERRORS: ReadonlyMap<string, AppError> = new Map<string, AppError>([
  [
    AIErrorCode.API_NOT_ENABLED,
    createAppError('OnDeviceUnavailable', {
      message: 'On-device AI is not available in this browser (api-not-enabled).',
    }),
  ],
  [
    AIErrorCode.UNSUPPORTED,
    createAppError('OnDeviceUnavailable', {
      message: 'On-device AI cannot run this request here (unsupported).',
    }),
  ],
  [
    AIErrorCode.FETCH_ERROR,
    createAppError('Offline', { message: 'The AI service could not be reached (fetch-error).' }),
  ],
]);

/** Chrome Prompt API failures surface as DOMExceptions identified by `name`. */
const DOM_ERRORS: ReadonlyMap<string, AppError> = new Map<string, AppError>([
  [
    'NotAllowedError',
    createAppError('OnDeviceUnavailable', {
      message: 'The browser did not allow the on-device model to start (NotAllowedError).',
    }),
  ],
  [
    'InvalidStateError',
    createAppError('OnDeviceUnavailable', {
      message: 'The on-device model is in an invalid state (InvalidStateError).',
    }),
  ],
  [
    'NotSupportedError',
    createAppError('LanguageNotSupported', {
      message: 'The on-device model does not support this input or output (NotSupportedError).',
      // The Prompt API does not say which language it rejected: BCP 47 "undetermined".
      language: 'und',
    }),
  ],
  [
    // The Prompt API rejects a prompt larger than the session's token quota this way
    // (in recent Chrome, a QuotaExceededError subclass of DOMException).
    'QuotaExceededError',
    createAppError('InputTooLong', {
      message: 'The input is too long for the on-device model (QuotaExceededError).',
    }),
  ],
]);

const UNKNOWN: AppError = createAppError('Unknown', { message: 'Unexpected AI error.' });

export function mapAiError(error: unknown): AppError {
  if (error instanceof AIError) return AI_ERRORS.get(error.code) ?? UNKNOWN;
  if (error instanceof DOMException) return DOM_ERRORS.get(error.name) ?? UNKNOWN;
  return UNKNOWN;
}
