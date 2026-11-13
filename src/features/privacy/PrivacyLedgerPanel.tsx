import { ledgerLine } from './ledgerLabels';
import { usePrivacyLedger } from './usePrivacyLedger';

/**
 * "What happened to your text": every step that touched the text in this session, where it
 * ran and what it did. Lives in this tab's memory only and never shows the text itself.
 */
export function PrivacyLedgerPanel() {
  const entries = usePrivacyLedger();
  return (
    <details className="max-w-prose rounded-md border border-border bg-surface p-4">
      <summary className="cursor-pointer text-base font-semibold">
        What happened to your text
      </summary>
      <p className="mt-3 text-muted">
        Kept in this tab only, and gone when you reload or close it. It lists where each step ran,
        never your words.
      </p>
      {entries.length === 0 ? (
        <p className="mt-3">Nothing has happened to your text yet.</p>
      ) : (
        <ol aria-label="Steps so far" className="mt-3 list-decimal space-y-2 pl-6">
          {entries.map((entry, index) => (
            <li key={`${String(index)}-${entry.task}`}>{ledgerLine(entry)}</li>
          ))}
        </ol>
      )}
    </details>
  );
}
