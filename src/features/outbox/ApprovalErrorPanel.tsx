import type { AppError } from '../../shared/appError';
import { Button } from '../../ui';
import { approvalErrorCopy } from './outboxCopy';

export interface ApprovalErrorPanelProps {
  readonly error: AppError;
  readonly onBackToReview: () => void;
  readonly onBackToOutbox: () => void;
}

/** A refused approval: what is wrong and one way back to where it can be fixed. */
export function ApprovalErrorPanel({ error, ...props }: ApprovalErrorPanelProps) {
  const copy = approvalErrorCopy(error.kind);
  const toReview = copy.target === 'review';
  return (
    <section className="max-w-xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        This text was not approved
      </h1>
      <p role="alert" className="mt-4 text-lg">
        {copy.message}
      </p>
      <p className="mt-2 text-muted">Nothing has been sent. Your text is still only in this tab.</p>
      <div className="mt-6">
        <Button onClick={toReview ? props.onBackToReview : props.onBackToOutbox}>
          {toReview ? 'Back to review' : 'Back to approval'}
        </Button>
      </div>
    </section>
  );
}
