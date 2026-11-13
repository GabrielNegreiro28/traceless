import type { DeviceAvailability } from '../../application/ports/DeviceCapability';
import { friendlyErrorMessage } from './errorMessages';
import type { DeviceStatus } from './useDeviceStatus';

const TEXT: Readonly<Record<DeviceAvailability, string>> = {
  available: 'On-device AI is ready. You can run an evaluation.',
  downloadable:
    'On-device AI is not downloaded yet. Click "Prepare on-device AI" (the download can take several minutes).',
  downloading: 'On-device AI is downloading. Wait a few minutes, then reload this page.',
  unavailable:
    'On-device AI is not available. In Chrome on a computer: 1. open chrome://flags/#prompt-api-for-gemini-nano-multimodal-input, 2. set it to Enabled, 3. restart Chrome, 4. check chrome://on-device-internals, then reload this page.',
};

export function DevicePanel({ device }: { readonly device: DeviceStatus }) {
  const { availability, progress, error, prepare } = device;
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <h2 className="font-semibold">Device status</h2>
      <p className="mt-1 text-muted" role="status">
        {availability === null ? 'Checking this device...' : TEXT[availability]}
      </p>
      {availability === 'downloadable' && progress === null && (
        <button type="button" onClick={prepare} className={BUTTON}>
          Prepare on-device AI
        </button>
      )}
      {progress !== null && (
        <progress className="mt-3 w-full" value={progress} max={1} aria-label="Model download" />
      )}
      {error !== null && <p className="mt-2 text-danger">{friendlyErrorMessage(error)}</p>}
    </section>
  );
}

export const BUTTON =
  'mt-3 rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast disabled:opacity-50';
