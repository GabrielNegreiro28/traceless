import { useCallback, useEffect, useRef, useState } from 'react';
import {
  evaluateDetection,
  type EvalProgress,
  type EvalRunResult,
} from '../../application/usecases/evaluateDetection';
import type { AppError } from '../../shared/appError';
import { datasetForPreset, EVAL_PRESETS, type EvalPreset, type PresetId } from './evalPresets';
import type { EvalServices } from './evalServices';
import { EVAL_VARIANTS, type EvalVariant } from './evalVariants';

export type SaveState =
  | { readonly kind: 'saved'; readonly file: string }
  | { readonly kind: 'failed'; readonly error: AppError };

/** The finished evaluation of one variant and what happened when saving it. */
export interface VariantOutcome {
  readonly variant: EvalVariant;
  readonly result: EvalRunResult;
  readonly save: SaveState;
}

/** Which variant of the preset is running (1-based `index` of `total`). */
export interface VariantPosition {
  readonly id: string;
  readonly index: number;
  readonly total: number;
}

export type RunState =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'running';
      readonly preset: EvalPreset;
      readonly variant: VariantPosition;
      readonly progress: EvalProgress | null;
      readonly elapsedMs: number;
      readonly lastLatencyMs: number | null;
    }
  | {
      readonly phase: 'done';
      readonly preset: EvalPreset;
      readonly outcomes: readonly VariantOutcome[];
    }
  | { readonly phase: 'error'; readonly error: AppError };

const TICK_MS = 500;

export interface EvalRunner {
  readonly state: RunState;
  /** Runs the preset; presets with `variants: 'all'` ignore `variant` and run every one. */
  readonly start: (presetId: PresetId, variant: EvalVariant) => void;
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
    (presetId: PresetId, variant: EvalVariant) => {
      const preset = EVAL_PRESETS.find((p) => p.id === presetId);
      if (preset === undefined || busy.current) return;
      busy.current = true;
      const variants = preset.variants === 'all' ? EVAL_VARIANTS : [variant];
      void execute(services, preset, variants, startedAt, setState).finally(() => {
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
  variants: readonly EvalVariant[],
  startedAt: { current: number },
  setState: (state: RunState) => void,
): Promise<void> {
  startedAt.current = services.clock.now();
  const outcomes: VariantOutcome[] = [];
  for (const [index, variant] of variants.entries()) {
    const position = { id: variant.id, index: index + 1, total: variants.length };
    const outcome = await runVariant(services, preset, variant, position, startedAt, setState);
    if (!outcome.ok) return setState({ phase: 'error', error: outcome.error });
    outcomes.push(outcome.value);
  }
  setState({ phase: 'done', preset, outcomes });
}

type VariantRun = { ok: true; value: VariantOutcome } | { ok: false; error: AppError };

async function runVariant(
  services: EvalServices,
  preset: EvalPreset,
  variant: EvalVariant,
  position: VariantPosition,
  startedAt: { current: number },
  setState: (state: RunState) => void,
): Promise<VariantRun> {
  const { clock } = services;
  let lastTick = clock.now();
  const running = (progress: EvalProgress | null, now: number, lastLatencyMs: number | null) =>
    setState({
      phase: 'running',
      preset,
      variant: position,
      progress,
      elapsedMs: now - startedAt.current,
      lastLatencyMs,
    });
  running(null, lastTick, null);
  const result = await evaluateDetection({
    dataset: datasetForPreset(services.dataset, preset),
    split: preset.split,
    scan: services.scanFor(variant),
    clock,
    runs: preset.runs,
    variant,
    onProgress: (progress) => {
      const now = clock.now();
      running(progress, now, now - lastTick);
      lastTick = now;
    },
  });
  if (!result.ok) return { ok: false, error: result.error };
  const saved = await services.saveResult(result.value);
  const save: SaveState = saved.ok
    ? { kind: 'saved', file: saved.value }
    : { kind: 'failed', error: saved.error };
  return { ok: true, value: { variant, result: result.value, save } };
}
