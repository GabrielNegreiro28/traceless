import type { AppError } from '../../shared/appError';
import { Button } from '../../ui';
import { reporterErrorMessage } from './reporterErrorMessages';

export interface FlowErrorPanelProps {
  readonly error: AppError;
  /** Returns to the state the error interrupted. */
  readonly onTryAgain: () => void;
}

export function FlowErrorPanel({ error, onTryAgain }: FlowErrorPanelProps) {
  return (
    <section className="max-w-xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        That didn&apos;t work
      </h1>
      <p role="alert" className="mt-4 text-lg">
        {reporterErrorMessage(error.kind)}
      </p>
      <div className="mt-6">
        <Button onClick={onTryAgain}>Try again</Button>
      </div>
    </section>
  );
}
