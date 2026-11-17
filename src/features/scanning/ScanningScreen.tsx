import { Button, ProgressBar } from '../../ui';
import type { ScanMode } from '../review/reportFlowTypes';

export interface ScanningScreenProps {
  /**
   * Null until the scanner reports its step count: one per model call over a part of the
   * report (scan passes, then the on-device phrase checks when the pipeline has them).
   */
  readonly progress: { readonly done: number; readonly total: number } | null;
  readonly onCancel: () => void;
  /** Where the scan runs; the reassurance line must match it (default: on this device). */
  readonly mode?: ScanMode;
  /** The demo scanner stands in for the AI: nothing leaves the device, in any mode. */
  readonly demo?: boolean;
}

const REASSURANCE: Readonly<Record<ScanMode, string>> = {
  onDevice: 'Usually 15–40 seconds, running on this computer. Nothing is uploaded.',
  consentedCloud:
    'Checking in the cloud, as you agreed. Usually a few seconds. Traceless stores nothing.',
};

const DEMO_CLOUD_REASSURANCE =
  'Demo mode: the demo scanner stands in for the cloud check. Nothing leaves this device.';

function reassurance(mode: ScanMode, demo: boolean): string {
  return demo && mode === 'consentedCloud' ? DEMO_CLOUD_REASSURANCE : REASSURANCE[mode];
}

function progressLine(progress: ScanningScreenProps['progress']): string {
  if (progress === null) return 'Getting ready to read your report.';
  return `Finished ${String(progress.done)} of ${String(progress.total)} ${progress.total === 1 ? 'step' : 'steps'}.`;
}

/** Shown while the scan runs: determinate progress once known, and a way to stop. */
export function ScanningScreen({
  progress,
  onCancel,
  mode = 'onDevice',
  demo = false,
}: ScanningScreenProps) {
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
      <p className="mt-4 text-lg">{reassurance(mode, demo)}</p>
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
