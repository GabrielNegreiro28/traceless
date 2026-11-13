import type { LedgerEntry, LedgerTask } from '../../application/ports/PrivacyLedger';

/** Plain-language lines for the privacy ledger. Entries hold no text, so neither do these. */

const TASK_LABELS: Readonly<Record<LedgerTask, string>> = {
  identityScan: 'Identity scan',
  approve: 'Approval',
};

/** Where it ran. The demo scanner is labelled so fake mode never reads as on-device AI. */
export function whereLabel(entry: LedgerEntry): string {
  switch (entry.source) {
    case 'onDevice':
      return 'on your device (on-device AI)';
    case 'rules':
      return 'on your device (pattern rules only)';
    case 'local':
      return entry.demo ? 'on your device (demo scanner)' : 'on your device';
    case 'cloud':
      return 'in the cloud, with your consent';
  }
}

/** What happened to the text in that step. */
export function whatLabel(entry: LedgerEntry): string {
  if (entry.dataClass === 'SANITIZED') return 'created the text you approved';
  return entry.source === 'cloud'
    ? 'your original text, sent for this scan only'
    : 'your original text, never left this device';
}

/** "Identity scan · on your device (on-device AI) · your original text, never left this device" */
export function ledgerLine(entry: LedgerEntry): string {
  return [TASK_LABELS[entry.task], whereLabel(entry), whatLabel(entry)].join(' · ');
}
