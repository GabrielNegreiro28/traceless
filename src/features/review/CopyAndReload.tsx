import { useState } from 'react';
import { Button } from '../../ui';

export interface CopyAndReloadProps {
  /** The reporter's draft; copied to the clipboard, never logged or stored. */
  readonly text: string;
  readonly copyText: (text: string) => Promise<boolean>;
  readonly reload: () => void;
}

type Step = 'idle' | 'copying' | 'copied' | 'copyFailed';

const WARNING = 'Reloading clears the draft from this page.';

/**
 * "Copy my text and reload": copies first, then warns that the reload clears the draft, and
 * reloads only after "Reload now". If the copy fails, the text is shown for a manual copy.
 */
export function CopyAndReload({ text, copyText, reload }: CopyAndReloadProps) {
  const [step, setStep] = useState<Step>('idle');
  const copy = (): void => {
    setStep('copying');
    void copyText(text).then(
      (copied) => setStep(copied ? 'copied' : 'copyFailed'),
      () => setStep('copyFailed'),
    );
  };
  if (step === 'idle' || step === 'copying') {
    return (
      <div>
        <Button variant="secondary" loading={step === 'copying'} onClick={copy}>
          Copy my text and reload
        </Button>
        <p className="mt-2 text-muted">Reloading restarts the on-device AI. {WARNING}</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      {step === 'copied' ? (
        <p role="status">
          Your text is copied. {WARNING} After the reload, paste it back in and check it again.
        </p>
      ) : (
        <>
          <p role="alert">
            We couldn&apos;t copy your text automatically. Copy it from the box below first.{' '}
            {WARNING}
          </p>
          <textarea
            readOnly
            aria-label="Your report text"
            value={text}
            rows={6}
            className="mt-3 w-full rounded-md border border-border bg-bg p-2"
          />
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={reload}>Reload now</Button>
        <Button variant="secondary" onClick={() => setStep('idle')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
