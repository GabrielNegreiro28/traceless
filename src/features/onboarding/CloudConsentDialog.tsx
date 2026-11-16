import { useId, useState, type FormEvent } from 'react';
import { Button, Dialog } from '../../ui';
import {
  GEMINI_API_TERMS_LABEL,
  GEMINI_API_TERMS_URL,
  OWN_TEXT_ACK_LABEL,
  OWN_TEXT_RISKS,
} from './checkOptionsCopy';

export interface CloudConsentDialogProps {
  readonly open: boolean;
  readonly onCancel: () => void;
  /** Called only after the reporter ticked the checkbox and confirmed. */
  readonly onConfirm: () => void;
}

/** Remounted on every opening, so the checkbox always starts unticked (consent per check). */
function ConsentForm({ onCancel, onConfirm }: Omit<CloudConsentDialogProps, 'open'>) {
  const [agreed, setAgreed] = useState(false);
  const hintId = useId();
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (agreed) onConfirm();
  };
  return (
    <form onSubmit={submit}>
      <ul className="list-disc space-y-2 pl-5">
        {OWN_TEXT_RISKS.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>
      <p className="mt-3">
        <a
          href={GEMINI_API_TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2"
        >
          {GEMINI_API_TERMS_LABEL}
        </a>
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-1 size-5 shrink-0 accent-accent"
        />
        <span>{OWN_TEXT_ACK_LABEL}</span>
      </label>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!agreed} aria-describedby={agreed ? undefined : hintId}>
          Check in the cloud
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {!agreed && (
        <p id={hintId} className="mt-2 text-sm text-muted">
          Tick the box to continue.
        </p>
      )}
    </form>
  );
}

/**
 * Consent for sending the reporter's OWN text to the cloud: a native modal <dialog> that
 * explains the risk in plain words and needs a ticked checkbox. Nothing is remembered: the
 * next check asks again.
 */
export function CloudConsentDialog({ open, onCancel, onConfirm }: CloudConsentDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title="Check your text in the cloud?">
      {open && <ConsentForm onCancel={onCancel} onConfirm={onConfirm} />}
    </Dialog>
  );
}
