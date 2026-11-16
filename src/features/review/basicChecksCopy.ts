/**
 * Copy for a review that only ran the pattern rules (the basic private check). Basic checks
 * see emails, phone numbers, IDs, explicit dates and sign-offs, never indirect details, so
 * the app never presents "nothing found" as "no risk".
 */

export const BASIC_RISK_NOT_RATED_TITLE = 'Risk not rated';

export const BASIC_RISK_NOT_RATED =
  "Basic checks can't see indirect details such as your role, shift, location or team, so they can't tell how recognizable your report is.";

export const BASIC_RISK_MAY_BE_HIGHER =
  "Basic checks can't see indirect details such as your role, shift, location or team, so your real risk may be higher.";

export const BASIC_CONFIRMATION_LABEL =
  'I understand only basic checks ran: details like my role, shift or location were not checked, and this text may still allow someone to recognize me.';
