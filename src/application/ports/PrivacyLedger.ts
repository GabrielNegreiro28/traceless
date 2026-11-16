/**
 * The privacy ledger (design plan §1, "Privacy ledger"): a session-only record of what
 * happened to the reporter's text. Entries describe the task, where it ran and the class of
 * data it touched. They never hold report text, quotes, finding counts or anything else that
 * could fingerprint the report, and they are never stored or sent.
 */

/** Tasks that touch the reporter's text (grows with the policy table). */
export type LedgerTask = 'identityScan' | 'approve' | 'submit';

/**
 * Where the task ran: the on-device model, the cloud, deterministic pattern rules only, or
 * ordinary local code (no model at all, for example the approval or the demo scanner).
 */
export type LedgerSource = 'onDevice' | 'cloud' | 'rules' | 'local';

/**
 * Privacy class of the text the task read (PLANO §3.3). CONSENTED_RAW marks the consented
 * cloud scan, so it never reads like an on-device scan of RAW text.
 */
export type LedgerDataClass = 'RAW' | 'CONSENTED_RAW' | 'SANITIZED';

export interface LedgerEntry {
  readonly task: LedgerTask;
  readonly source: LedgerSource;
  readonly dataClass: LedgerDataClass;
  /** True when a deterministic demo scanner stood in for the AI (fake AI mode). */
  readonly demo: boolean;
  /** Clock time of the entry (ms); only orders entries, never shown as a timestamp. */
  readonly at: number;
}

/** Read side, the only part features receive: a plain observable list. */
export interface PrivacyLedgerView {
  /** The same array instance until the next record, so React can subscribe to it. */
  readonly entries: () => readonly LedgerEntry[];
  /** Calls `listener` after every record; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

/** Write side, used only by the composition root's decorators. */
export interface PrivacyLedger extends PrivacyLedgerView {
  readonly record: (entry: LedgerEntry) => void;
}
