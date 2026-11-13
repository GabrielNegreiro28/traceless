import { Button, ProgressBar } from '../../ui';

export interface ScanningScreenProps {
  /** Null until the scanner reports how many parts the report has. */
  readonly progress: { readonly done: number; readonly total: number } | null;
  readonly onCancel: () => void;
}

function progressLine(progress: ScanningScreenProps['progress']): string {
  if (progress === null) return 'Getting ready to read your report.';
  return `Checked ${String(progress.done)} of ${String(progress.total)} ${progress.total === 1 ? 'part' : 'parts'}.`;
}

/** Shown while the on-device scan runs: determinate progress once known, and a way to stop. */
export function ScanningScreen({ progress, onCancel }: ScanningScreenProps) {
  return (
    <section className="max-w-xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Checking your report
      </h1>
      <div className="mt-6">
        <ProgressBar
          label="Checking your report"
          {...(progress === null ? {} : { value: progress.done / progress.total })}
        />
      </div>
      <p className="mt-4 text-lg">
        About 10–20 seconds, running on this computer. Nothing is uploaded.
      </p>
      <p aria-live="polite" className="mt-1 text-muted">
        {progressLine(progress)}
      </p>
      <div className="mt-6">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
