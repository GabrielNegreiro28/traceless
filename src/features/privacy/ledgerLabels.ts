import type { LedgerEntry, LedgerTask } from '../../application/ports/PrivacyLedger';

/** Plain-language lines for the privacy ledger. Entries hold no text, so neither do these. */

const TASK_LABELS: Readonly<Record<LedgerTask, string>> = {
  identityScan: 'Identity scan',
  approve: 'Approval',
  structureReport: 'Organized for the organization',
  submit: 'Sent to the organization',
};

/** Where it ran. The demo scanner is labelled so fake mode never reads as on-device AI. */
export function whereLabel(entry: LedgerEntry): string {
  if (entry.task === 'submit') {
    return entry.demo ? 'demo mode, kept in this tab' : 'to the organization (Firestore)';
  }
  switch (entry.source) {
    case 'onDevice':
      return 'on your device (on-device AI)';
    case 'rules':
      return 'on your device (pattern rules only)';
    case 'local':
      if (!entry.demo) return 'on your device';
      return entry.task === 'structureReport'
        ? 'on your device (demo organizer)'
        : 'on your device (demo scanner)';
    case 'cloud':
      // Approved text needs no consent; only raw text does.
      return entry.dataClass === 'SANITIZED' ? 'in the cloud' : 'in the cloud, with your consent';
  }
}

/** What happened to the text in that step. */
export function whatLabel(entry: LedgerEntry): string {
  if (entry.task === 'submit' || entry.task === 'structureReport') {
    return 'only the text you approved';
  }
  if (entry.dataClass === 'SANITIZED') return 'created the text you approved';
  return entry.source === 'cloud'
    ? 'your original text, sent for this scan only'
    : 'your original text, never left this device';
}

/** "Identity scan · on your device (on-device AI) · your original text, never left this device" */
export function ledgerLine(entry: LedgerEntry): string {
  return [TASK_LABELS[entry.task], whereLabel(entry), whatLabel(entry)].join(' · ');
}
