import { Button } from '../../ui';

/** Minimal stand-in for the review screen (built in the next task). */
export function ReviewPlaceholder(props: {
  readonly findingCount: number;
  readonly onBackToEdit: () => void;
}) {
  const { findingCount } = props;
  return (
    <section className="max-w-xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Review your report
      </h1>
      <p className="mt-4 text-lg">
        {findingCount} {findingCount === 1 ? 'detail' : 'details'} found
      </p>
      <div className="mt-6">
        <Button variant="secondary" onClick={props.onBackToEdit}>
          Back to edit
        </Button>
      </div>
    </section>
  );
}
