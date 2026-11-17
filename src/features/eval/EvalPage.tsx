import { useState } from 'react';
import { DevicePanel } from './DevicePanel';
import { EvalResults } from './EvalResults';
import { EVAL_PRESETS } from './evalPresets';
import { useEvalServices } from './evalServices';
import { DEFAULT_EVAL_VARIANT, EVAL_VARIANTS, findVariant } from './evalVariants';
import { friendlyErrorMessage } from './errorMessages';
import { RunProgress } from './RunProgress';
import { useDeviceStatus } from './useDeviceStatus';
import { useEvalRunner } from './useEvalRunner';

/** Appears only in this dev-only chunk; scripts/verify-no-eval-in-dist.mjs searches for it. */
export const EVAL_PAGE_SENTINEL = 'traceless-eval-page-v1';

export function EvalPage() {
  const services = useEvalServices();
  const device = useDeviceStatus(services.deviceCapability);
  const { state, start } = useEvalRunner(services);
  const [variantId, setVariantId] = useState(DEFAULT_EVAL_VARIANT.id);
  const variant = findVariant(variantId) ?? DEFAULT_EVAL_VARIANT;
  const running = state.phase === 'running';
  const canRun = device.availability === 'available' && !running;

  return (
    <main
      data-page={EVAL_PAGE_SENTINEL}
      className="mx-auto min-h-screen max-w-3xl space-y-4 bg-bg px-6 py-10 text-text"
    >
      <h1 className="text-2xl font-bold">Detection evaluation (developer tool)</h1>
      <p className="text-muted">
        Runs the on-device model on the evaluation reports and saves the numbers. No report text is
        shown or stored.
      </p>
      <DevicePanel device={device} />
      <section className="rounded-md border border-border bg-surface p-4">
        <label className="block font-semibold" htmlFor="variant">
          Variant
        </label>
        <select
          id="variant"
          value={variantId}
          disabled={running}
          onChange={(e) => setVariantId(e.target.value)}
          className="mt-1 rounded-md border border-border bg-bg px-2 py-1"
        >
          {EVAL_VARIANTS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-muted">
          A variant is its scan passes (prompt versions and strategies), the candidate verifier or
          not, chunk size, post-filters and rule pack. The Dev matrix, Round 2 and Round 3 run their
          own named variants and ignore this choice; Final v2 test runs the selected variant plus
          the shipped baseline on the held-out v2 test split (run it once only); the other presets
          run the selected one.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {EVAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!canRun}
              onClick={() => start(preset.id, variant)}
              className="rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>
      <RunProgress state={state} />
      {state.phase === 'error' && (
        <p role="alert" className="text-danger">
          {friendlyErrorMessage(state.error)}
        </p>
      )}
      <EvalResults state={state} />
    </main>
  );
}
