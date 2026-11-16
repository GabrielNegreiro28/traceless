import { describe, expect, it } from 'vitest';
import { APP_ERROR_KINDS } from '../../shared/appError';
import { reporterErrorMessage, reporterErrorMessageAfterCloud } from './reporterErrorMessages';

describe('reporterErrorMessage', () => {
  it.each(APP_ERROR_KINDS)('has calm copy for %s', (kind) => {
    const message = reporterErrorMessage(kind);
    expect(message.length).toBeGreaterThan(20);
    expect(message).not.toMatch(/guarantee/i);
    expect(message).not.toContain(kind);
  });
});

describe('reporterErrorMessageAfterCloud', () => {
  it.each(APP_ERROR_KINDS)('never claims the text stayed on this device for %s', (kind) => {
    const message = reporterErrorMessageAfterCloud(kind);
    expect(message.length).toBeGreaterThan(20);
    expect(message).not.toMatch(/anywhere|only in this tab|never left|Nothing was kept or sent/i);
    expect(message).not.toContain(kind);
  });

  it('says what is true instead: nothing reached the organization', () => {
    expect(reporterErrorMessageAfterCloud('ApprovalMismatch')).toContain(
      'Nothing has been sent to the organization.',
    );
    expect(reporterErrorMessageAfterCloud('Unknown')).toContain(
      'Nothing has been sent to the organization.',
    );
  });
});
