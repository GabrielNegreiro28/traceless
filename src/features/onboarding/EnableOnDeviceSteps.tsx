import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui';
import { ENABLE_FLAG_URL } from './checkOptionsCopy';
import { OptionCard } from './OptionCard';

type CopyState = 'idle' | 'copied' | 'failed';

const COPY_FEEDBACK: Readonly<Record<CopyState, string>> = {
  idle: '',
  copied: 'Address copied. Paste it into a new tab.',
  failed: "Couldn't copy automatically. Select the address and copy it.",
};

/** Copyable address: Chrome does not let web pages open chrome:// links. */
function FlagAddress({ copyText }: { readonly copyText: (text: string) => Promise<boolean> }) {
  const [copy, setCopy] = useState<CopyState>('idle');
  const onCopy = (): void => {
    void copyText(ENABLE_FLAG_URL).then(
      (copied) => setCopy(copied ? 'copied' : 'failed'),
      () => setCopy('failed'),
    );
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="rounded-sm bg-bg px-2 py-1 font-mono text-sm break-all">
        {ENABLE_FLAG_URL}
      </code>
      <Button variant="secondary" onClick={onCopy}>
        Copy address
      </Button>
      <p role="status" className="w-full text-sm text-muted">
        {COPY_FEEDBACK[copy]}
      </p>
    </div>
  );
}

/** How to turn on private on-device AI (design plan §2c). */
export function EnableOnDeviceSteps(props: {
  readonly copyText: (text: string) => Promise<boolean>;
}) {
  return (
    <OptionCard icon={Lock} tone="accent" title="Turn on private on-device AI">
      <p className="text-muted">Needs Chrome on a computer, version 139 or newer.</p>
      <ol className="mt-3 list-decimal space-y-3 pl-6">
        <li>
          Open this address in a new tab:
          <FlagAddress copyText={props.copyText} />
        </li>
        <li>Set the highlighted setting to Enabled.</li>
        <li>Relaunch Chrome, then come back to this page.</li>
      </ol>
      <p className="mt-3 text-muted">
        Phones and other browsers can&apos;t run on-device AI yet. Use one of the options above.
      </p>
    </OptionCard>
  );
}
