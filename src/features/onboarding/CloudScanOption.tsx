import { Cloud } from 'lucide-react';
import { useState } from 'react';
import type { CloudScanConsent } from '../../application/usecases/consentToCloudScan';
import { Button } from '../../ui';
import { CLOUD_CHECKING_NOTE, CLOUD_DISABLED_NOTE, SAMPLE_CLOUD_NOTE } from './checkOptionsCopy';
import { CloudConsentDialog } from './CloudConsentDialog';
import { OptionCard } from './OptionCard';
import type { CloudAvailability } from './useCloudScanAvailability';

export interface CloudScanOptionProps {
  readonly availability: CloudAvailability;
  /** The text is the unmodified fictional sample (exact match). */
  readonly sample: boolean;
  /** Starts the cloud scan with the consent just given; called only from a click. */
  readonly onScan: (consent: CloudScanConsent) => void;
}

const SAMPLE_CONSENT: CloudScanConsent = { kind: 'sample' };
const OWN_TEXT_CONSENT: CloudScanConsent = { kind: 'own-text', acknowledged: true };

function OwnTextAction({ onScan }: Pick<CloudScanOptionProps, 'onScan'>) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <p className="text-muted">
        The cloud AI reads your text to find the same kinds of details as the on-device AI. You
        decide first.
      </p>
      <div className="mt-3">
        <Button onClick={() => setAsking(true)}>Check my text in the cloud</Button>
      </div>
      <CloudConsentDialog
        open={asking}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onScan(OWN_TEXT_CONSENT);
        }}
      />
    </>
  );
}

function SampleAction({ onScan }: Pick<CloudScanOptionProps, 'onScan'>) {
  return (
    <>
      <p className="text-muted">{SAMPLE_CLOUD_NOTE}</p>
      <div className="mt-3">
        <Button onClick={() => onScan(SAMPLE_CONSENT)}>Check the sample in the cloud</Button>
      </div>
    </>
  );
}

/**
 * The consented cloud scan option (design plan §2b). The unmodified sample needs one click;
 * the reporter's own text needs the consent dialog. Hidden behind a note while the kill switch
 * is being read or is off.
 */
export function CloudScanOption({ availability, sample, onScan }: CloudScanOptionProps) {
  return (
    <OptionCard icon={Cloud} tone="cloud" title="Check in the cloud, with your consent">
      {availability === 'checking' && (
        <p role="status" className="text-muted">
          {CLOUD_CHECKING_NOTE}
        </p>
      )}
      {availability === 'disabled' && <p className="text-muted">{CLOUD_DISABLED_NOTE}</p>}
      {availability === 'enabled' &&
        (sample ? <SampleAction onScan={onScan} /> : <OwnTextAction onScan={onScan} />)}
    </OptionCard>
  );
}
