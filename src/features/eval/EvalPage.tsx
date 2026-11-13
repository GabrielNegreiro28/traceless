import { useState } from 'react';
import { DevicePanel } from './DevicePanel';
import { EvalResults } from './EvalResults';
import { EVAL_PRESETS } from './evalPresets';
import { EVAL_STRATEGIES, useEvalServices, type EvalStrategy } from './evalServices';
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
  const [strategy, setStrategy] = useState<EvalStrategy>('single');
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
        <label className="block font-semibold" htmlFor="strategy">
          Prompt strategy
        </label>
        <select
          id="strategy"
          value={strategy}
          disabled={running}
          onChange={(e) => setStrategy(e.target.value as EvalStrategy)}
          className="mt-1 rounded-md border border-border bg-bg px-2 py-1"
        >
          {EVAL_STRATEGIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-muted">
          Run &apos;single&apos; first. Try &apos;grouped2&apos; only if recall is below the target;
          it takes about twice as long.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {EVAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!canRun}
              onClick={() => start(preset.id, strategy)}
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
