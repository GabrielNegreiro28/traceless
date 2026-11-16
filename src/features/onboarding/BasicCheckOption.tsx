import { Ruler } from 'lucide-react';
import { Button } from '../../ui';
import { OptionCard } from './OptionCard';

/** "Basic private check (patterns only, no AI)": runs on this device and sends nothing. */
export function BasicCheckOption({ onRun }: { readonly onRun: () => void }) {
  return (
    <OptionCard icon={Ruler} tone="neutral" title="Basic private check (patterns only, no AI)">
      <p className="text-muted">
        Runs on this device and sends nothing. It finds emails, phone numbers, IDs, explicit dates
        and sign-offs, but it can&apos;t see indirect details like your role, shift or location.
      </p>
      <div className="mt-3">
        <Button variant="secondary" onClick={onRun}>
          Run the basic private check
        </Button>
      </div>
    </OptionCard>
  );
}
