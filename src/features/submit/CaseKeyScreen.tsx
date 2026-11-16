import { useId, useState } from 'react';
import { groupCaseKey, type CaseKey } from '../../domain/case/caseKey';
import { Button, Card } from '../../ui';
import { CASE_KEY_FILE_NAME, caseKeyFileText } from './caseKeyFile';
import { downloadTextFile } from './downloadTextFile';
import { useLeaveWarning } from './useLeaveWarning';

export interface CaseKeyScreenProps {
  /** Null only if the key was already dismissed; the screen then just confirms the send. */
  readonly caseKey: CaseKey | null;
  /** "Done", allowed once the reporter confirms they saved the key. Forgets the key. */
  readonly onFinish: () => void;
  readonly copyText: (text: string) => Promise<boolean>;
  readonly download?: (fileName: string, text: string) => void;
  /** Demo mode: the case lives only in this tab. */
  readonly demo?: boolean;
}

interface KeyActionsProps {
  readonly caseKey: CaseKey;
  readonly copyText: (text: string) => Promise<boolean>;
  readonly download: (fileName: string, text: string) => void;
}

function KeyActions({ caseKey, copyText, download }: KeyActionsProps) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const copy = () => void copyText(caseKey).then(setCopied);
  const save = () => download(CASE_KEY_FILE_NAME, caseKeyFileText(caseKey, window.location.origin));
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={copy}>
        Copy key
      </Button>
      <Button variant="secondary" onClick={save}>
        Download .txt
      </Button>
      <p role="status" className="text-muted">
        {copied === true && 'Copied.'}
        {copied === false && 'Copying was blocked. Select the key and copy it by hand.'}
      </p>
    </div>
  );
}

/**
 * Shown once after a successful send (ADR 0003): the case key in monospace groups of four,
 * Copy and Download .txt, and an "I saved my key" gate before leaving. The key is never
 * written to localStorage, sessionStorage, the URL or logs.
 */
export function CaseKeyScreen({
  caseKey,
  onFinish,
  copyText,
  download = downloadTextFile,
  demo = false,
}: CaseKeyScreenProps) {
  const [saved, setSaved] = useState(false);
  const checkboxId = useId();
  useLeaveWarning(caseKey !== null && !saved);
  return (
    <section className="max-w-2xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Report sent. Save your case key.
      </h1>
      <p className="mt-4 text-lg">
        This key is the only way to follow your case. It is shown once: Traceless does not keep it,
        and nobody can recover it for you.
      </p>
      {demo && <p className="mt-2 text-muted">Demo mode: this case exists only in this tab.</p>}
      {caseKey !== null && (
        <Card className="mt-6">
          <p className="text-sm font-semibold text-muted">Your case key</p>
          <p className="mt-2 font-mono text-2xl tracking-wider break-all" data-testid="case-key">
            {groupCaseKey(caseKey).join(' ')}
          </p>
          <KeyActions caseKey={caseKey} copyText={copyText} download={download} />
        </Card>
      )}
      <div className="mt-6 flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-1 size-5"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        <label htmlFor={checkboxId} className="text-lg">
          I saved my key somewhere safe
        </label>
      </div>
      <div className="mt-6">
        <Button onClick={onFinish} disabled={!saved}>
          Done
        </Button>
      </div>
    </section>
  );
}
