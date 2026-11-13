import type { RawText } from '../../domain/text/brandedText';
import { Button } from '../../ui';
import { CopyAndReload } from './CopyAndReload';

export interface StallPanelProps {
  /** From the OnDeviceStuck error: whether a new on-device try can work in this page load. */
  readonly recoverable: boolean;
  /** The kept draft (only for "Copy my text and reload"). */
  readonly text: RawText;
  readonly onTryAgain: () => void;
  readonly onBackToEdit: () => void;
  readonly onBasicChecks: () => void;
  readonly copyText: (text: string) => Promise<boolean>;
  readonly reload: () => void;
}

function Heading({ children }: { readonly children: string }) {
  return (
    <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
      {children}
    </h1>
  );
}

function RecoverableStall(props: StallPanelProps) {
  return (
    <section className="max-w-xl">
      <Heading>On-device AI stalled</Heading>
      <p role="alert" className="mt-4 text-lg">
        The private AI on this computer stopped responding, so the check stopped. It has been
        restarted. Your text is still here, and nothing was sent anywhere.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={props.onTryAgain}>Try again</Button>
        <Button variant="secondary" onClick={props.onBackToEdit}>
          Back to edit
        </Button>
      </div>
    </section>
  );
}

function TerminalStall(props: StallPanelProps) {
  return (
    <section className="max-w-xl">
      <Heading>On-device AI isn&apos;t responding</Heading>
      <p role="alert" className="mt-4 text-lg">
        The private AI on this computer stalled and can&apos;t restart until this page is reloaded.
        Your text is still here, and nothing was sent anywhere.
      </p>
      <div className="mt-6 flex flex-col gap-6">
        <div>
          <Button onClick={props.onBasicChecks}>Continue with basic checks</Button>
          <p className="mt-2 text-muted">
            Checks only patterns such as email addresses, phone numbers, dates and sign-offs.
            Details like your role, shift or location are not checked, so the Second look matters.
          </p>
        </div>
        <CopyAndReload text={props.text} copyText={props.copyText} reload={props.reload} />
      </div>
    </section>
  );
}

/**
 * A stalled on-device scan (docs/design/fase2-gate-iteration.md §G.2). Recoverable: try again
 * (the text is kept). Terminal: continue with basic checks (pattern rules only, no model), or
 * copy the text and reload.
 */
export function StallPanel(props: StallPanelProps) {
  return props.recoverable ? <RecoverableStall {...props} /> : <TerminalStall {...props} />;
}
