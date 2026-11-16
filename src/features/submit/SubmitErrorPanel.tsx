import type { AppError } from '../../shared/appError';
import { Button } from '../../ui';
import { submitErrorHeading, submitErrorMessage } from './submitCopy';

export interface SubmitErrorPanelProps {
  readonly error: AppError;
  /** Sends the same approved text again. */
  readonly onRetry: () => void;
  /** Returns to the approved text. */
  readonly onBack: () => void;
}

/** A failed send: the approved report is kept in this tab, ready to send again. */
export function SubmitErrorPanel({ error, onRetry, onBack }: SubmitErrorPanelProps) {
  return (
    <section className="max-w-xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        {submitErrorHeading(error.kind)}
      </h1>
      <p role="alert" className="mt-4 text-lg">
        {submitErrorMessage(error.kind)}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onRetry}>Try sending again</Button>
        <Button variant="secondary" onClick={onBack}>
          Back to the approved text
        </Button>
      </div>
    </section>
  );
}
