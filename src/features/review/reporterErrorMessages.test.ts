import { describe, expect, it } from 'vitest';
import { APP_ERROR_KINDS } from '../../shared/appError';
import { reporterErrorMessage } from './reporterErrorMessages';

describe('reporterErrorMessage', () => {
  it.each(APP_ERROR_KINDS)('has calm copy for %s', (kind) => {
    const message = reporterErrorMessage(kind);
    expect(message.length).toBeGreaterThan(20);
    expect(message).not.toMatch(/guarantee/i);
    expect(message).not.toContain(kind);
  });
});
