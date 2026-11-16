import type { AppError } from '../../shared/appError';
import { Button } from '../../ui';
import { cloudScanErrorMessage } from './cloudScanErrorMessages';
import { reporterErrorMessage, reporterErrorMessageAfterCloud } from './reporterErrorMessages';

export interface FlowErrorPanelProps {
  readonly error: AppError;
  /** Returns to the state the error interrupted. */
  readonly onTryAgain: () => void;
  /** The error ended a consented cloud scan: cloud copy, and the way back leads to the options. */
  readonly cloud?: boolean;
  /** The error came later in a flow whose text was checked in the cloud (with consent). */
  readonly afterCloud?: boolean;
}

function messageFor(kind: AppError['kind'], cloud: boolean, afterCloud: boolean): string {
  if (cloud) return cloudScanErrorMessage(kind);
  return afterCloud ? reporterErrorMessageAfterCloud(kind) : reporterErrorMessage(kind);
}

export function FlowErrorPanel({
  error,
  onTryAgain,
  cloud = false,
  afterCloud = false,
}: FlowErrorPanelProps) {
  return (
    <section className="max-w-xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        That didn&apos;t work
      </h1>
      <p role="alert" className="mt-4 text-lg">
        {messageFor(error.kind, cloud, afterCloud)}
      </p>
      <div className="mt-6">
        <Button onClick={onTryAgain}>{cloud ? 'Back to the options' : 'Try again'}</Button>
      </div>
    </section>
  );
}
