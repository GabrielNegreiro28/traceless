import { useCallback, useEffect, useRef, useState } from 'react';
import {
  evaluateDetection,
  type EvalProgress,
  type EvalRunResult,
} from '../../application/usecases/evaluateDetection';
import type { AppError } from '../../shared/appError';
import { datasetForPreset, EVAL_PRESETS, type EvalPreset, type PresetId } from './evalPresets';
import type { EvalServices, EvalStrategy } from './evalServices';

export type SaveState =
  | { readonly kind: 'saved'; readonly file: string }
  | { readonly kind: 'failed'; readonly error: AppError };

export type RunState =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'running';
      readonly preset: EvalPreset;
      readonly progress: EvalProgress | null;
      readonly elapsedMs: number;
      readonly lastLatencyMs: number | null;
    }
  | {
      readonly phase: 'done';
      readonly preset: EvalPreset;
      readonly result: EvalRunResult;
      readonly save: SaveState;
    }
  | { readonly phase: 'error'; readonly error: AppError };

const TICK_MS = 500;

export interface EvalRunner {
  readonly state: RunState;
  readonly start: (presetId: PresetId, strategy: EvalStrategy) => void;
}

/** Runs an evaluation preset, one at a time, tracking progress, timing and saving. */
export function useEvalRunner(services: EvalServices): EvalRunner {
  const [state, setState] = useState<RunState>({ phase: 'idle' });
  const busy = useRef(false);
  const startedAt = useRef(0);

  // Elapsed time ticks only while a run is in progress.
  const running = state.phase === 'running';
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const elapsedMs = services.clock.now() - startedAt.current;
      setState((s) => (s.phase === 'running' ? { ...s, elapsedMs } : s));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, services.clock]);

  const start = useCallback(
    (presetId: PresetId, strategy: EvalStrategy) => {
      const preset = EVAL_PRESETS.find((p) => p.id === presetId);
      if (preset === undefined || busy.current) return;
      busy.current = true;
      void execute(services, preset, strategy, startedAt, setState).finally(() => {
        busy.current = false;
      });
    },
    [services],
  );

  return { state, start };
}

async function execute(
  services: EvalServices,
  preset: EvalPreset,
  strategy: EvalStrategy,
  startedAt: { current: number },
  setState: (state: RunState) => void,
): Promise<void> {
  const { clock } = services;
  startedAt.current = clock.now();
  let lastTick = startedAt.current;
  setState({ phase: 'running', preset, progress: null, elapsedMs: 0, lastLatencyMs: null });
  const result = await evaluateDetection({
    dataset: datasetForPreset(services.dataset, preset),
    split: preset.split,
    scan: services.scanFor(strategy),
    clock,
    runs: preset.runs,
    promptVersion: services.promptVersion,
    strategy,
    onProgress: (progress) => {
      const now = clock.now();
      setState({
        phase: 'running',
        preset,
        progress,
        elapsedMs: now - startedAt.current,
        lastLatencyMs: now - lastTick,
      });
      lastTick = now;
    },
  });
  if (!result.ok) return setState({ phase: 'error', error: result.error });
  const saved = await services.saveResult(result.value);
  const save: SaveState = saved.ok
    ? { kind: 'saved', file: saved.value }
    : { kind: 'failed', error: saved.error };
  setState({ phase: 'done', preset, result: result.value, save });
}
