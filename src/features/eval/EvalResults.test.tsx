import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EvalRunResult } from '../../application/usecases/evaluateDetection';
import type { GateCheck } from '../../domain/evaluation/gate';
import { createAppError } from '../../shared/appError';
import { EvalResults } from './EvalResults';
import { EVAL_PRESETS } from './evalPresets';
import { EVAL_VARIANTS, type EvalVariant } from './evalVariants';
import type { RunState } from './useEvalRunner';

type DoneState = Extract<RunState, { phase: 'done' }>;
type SaveState = DoneState['outcomes'][number]['save'];

const CHECK: GateCheck = {
  name: 'strict recall',
  metric: 'strictRecallAll',
  comparison: '>=',
  threshold: 0.7,
  pooled: 0.8,
  worstRun: 0.8,
  missingRuns: 0,
  pass: true,
  unstable: false,
};

const SAVED: SaveState = { kind: 'saved', file: 'x.json' };

function doneState(checks: GateCheck[] | null, save: SaveState = SAVED): DoneState {
  const result = {
    promptVersion: 'identityScan.v1',
    strategy: 'single',
    split: 'test',
    runs: [
      {
        reports: [
          { reportId: 'r1', errorKind: 'InvalidModelOutput' },
          { reportId: 'r2', errorKind: null },
        ],
      },
      { reports: [{ reportId: 'r1', errorKind: 'InvalidModelOutput' }] },
    ],
    summary: {
      reports: 2,
      pooled: { strictRecallAll: 0.8, latencyP50Ms: 1234 },
      metrics: { strictRecallAll: { mean: 0.8, min: 0.75, max: 0.85, missingRuns: 0 } },
    },
    gate:
      checks === null
        ? null
        : {
            pass: checks.every((c) => c.pass),
            accusedBand: 'CONDITIONAL',
            unstable: checks.some((c) => c.unstable),
            checks,
          },
  } as unknown as EvalRunResult;
  const preset = EVAL_PRESETS[4];
  if (preset === undefined) throw new Error('preset missing');
  const variant = { ...EVAL_VARIANTS[0], id: 'v1-single' } as EvalVariant;
  return { phase: 'done', preset, outcomes: [{ variant, result, save }] };
}

describe('EvalResults', () => {
  it('shows pooled, min and max values', () => {
    render(<EvalResults state={doneState(null)} />);
    const row = screen.getByRole('row', { name: /Strict recall/ });
    expect(row).toHaveTextContent('80.0%');
    expect(row).toHaveTextContent('75.0%');
    expect(row).toHaveTextContent('85.0%');
    expect(screen.getByRole('row', { name: /Median scan time/ })).toHaveTextContent('1234 ms');
  });

  it('marks gate criteria as pass, unstable or fail', () => {
    const checks: GateCheck[] = [
      CHECK,
      { ...CHECK, metric: 'scanFailureRate', name: 'scan failures', unstable: true },
      { ...CHECK, metric: 'oversizedRate', name: 'oversized findings', pass: false },
    ];
    render(<EvalResults state={doneState(checks)} />);

    expect(screen.getByText(/Go\/no-go checklist: FAIL/)).toBeInTheDocument();
    expect(screen.getByText('PASS')).toBeInTheDocument();
    expect(screen.getByText('UNSTABLE')).toBeInTheDocument();
    expect(screen.getByText('FAIL')).toBeInTheDocument();
  });

  it('shows the ACCUSED band and the variant', () => {
    render(<EvalResults state={doneState([CHECK])} />);
    expect(screen.getByText('CONDITIONAL')).toBeInTheDocument();
    expect(screen.getByText(/protected-chips confirmation/)).toBeInTheDocument();
    expect(screen.getByText(/Variant v1-single/)).toBeInTheDocument();
  });

  it('passes the gate when every criterion passes', () => {
    render(<EvalResults state={doneState([CHECK])} />);
    expect(screen.getByText(/Go\/no-go checklist: PASS/)).toBeInTheDocument();
  });

  it('tells the user to download when saving failed', () => {
    const error = createAppError('Unknown', { message: 'dev server down' });
    render(<EvalResults state={doneState(null, { kind: 'failed', error })} />);
    expect(screen.getByText(/Could not save the file/)).toBeInTheDocument();
  });

  it('lists failed reports grouped by error kind with counts', () => {
    render(<EvalResults state={doneState(null)} />);
    const item = screen.getByText(/The model answered in a format/).closest('li');
    expect(item).toHaveTextContent('2x');
    expect(item).toHaveTextContent('r1');
    expect(item).not.toHaveTextContent('r2');
  });
});
