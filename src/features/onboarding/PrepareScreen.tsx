import { Button, ProgressBar } from '../../ui';

export interface PrepareScreenProps {
  /** Null until the download starts; then the fraction 0..1. */
  readonly progress: number | null;
  /** Must start the download straight from this click (Chrome needs user activation). */
  readonly onPrepare: () => void;
  readonly onBack: () => void;
}

/** One-time setup of the on-device model, started by the reporter's own click. */
export function PrepareScreen({ progress, onPrepare, onBack }: PrepareScreenProps) {
  const preparing = progress !== null;
  return (
    <section className="max-w-xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Set up private mode
      </h1>
      <p className="mt-4 text-lg">
        To check your report on this computer, Chrome first needs to download an AI model. This
        happens once, takes a few minutes and uses several gigabytes of space.
      </p>
      <p className="mt-2 text-muted">
        Your report isn&apos;t sent anywhere while this happens. The check starts on its own when
        the download finishes.
      </p>
      {preparing && (
        <div className="mt-6">
          <ProgressBar label="Preparing private AI" value={progress} />
          <p aria-live="polite" className="mt-2 text-muted">
            Downloading: {String(Math.round(progress * 100))}%
          </p>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onPrepare} loading={preparing}>
          Prepare private AI
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </section>
  );
}
