import type { CloudScanConsent } from '../../application/usecases/consentToCloudScan';
import { isUnmodifiedSample } from '../../domain/report/sampleReport';
import { Button } from '../../ui';
import { BasicCheckOption } from './BasicCheckOption';
import { CloudScanOption } from './CloudScanOption';
import { EnableOnDeviceSteps } from './EnableOnDeviceSteps';
import type { CloudAvailability } from './useCloudScanAvailability';

export interface CheckOptionsScreenProps {
  /** The reporter's text; only compared with the sample here, never shown or sent. */
  readonly text: string;
  readonly cloud: CloudAvailability;
  readonly onCloudScan: (consent: CloudScanConsent) => void;
  readonly onBasicCheck: () => void;
  readonly onBack: () => void;
  readonly copyText: (text: string) => Promise<boolean>;
}

/**
 * When private on-device AI isn't ready (design plan §2): (b) a cloud check with explicit
 * consent, (a) the basic private check, (c) how to turn on on-device AI. Nothing is sent
 * without a click on one of the options. The screen is also reached after a failed cloud
 * check, so it never claims that nothing was ever sent.
 */
export function CheckOptionsScreen(props: CheckOptionsScreenProps) {
  return (
    <section className="max-w-2xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Choose how to check your report
      </h1>
      <p className="mt-4 text-lg">
        Private on-device AI isn&apos;t ready in this browser. Nothing leaves this device unless you
        choose the cloud check below.
      </p>
      <div className="mt-6 flex flex-col gap-4">
        <CloudScanOption
          availability={props.cloud}
          sample={isUnmodifiedSample(props.text)}
          onScan={props.onCloudScan}
        />
        <BasicCheckOption onRun={props.onBasicCheck} />
        <EnableOnDeviceSteps copyText={props.copyText} />
      </div>
      <div className="mt-6">
        <Button variant="secondary" onClick={props.onBack}>
          Back to edit
        </Button>
      </div>
    </section>
  );
}
