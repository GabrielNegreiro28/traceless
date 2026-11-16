import { Circle, CircleAlert, CircleCheck } from 'lucide-react';
import type { TimelineStep } from '../../domain/case/caseTimeline';
import { formatDate, STEP_LABELS } from './followupCopy';

function stepDetail(step: TimelineStep): string {
  if (step.at !== null) return formatDate(step.at);
  const due = step.dueAt === null ? '' : formatDate(step.dueAt);
  if (step.done) return `Done (due by ${due})`;
  return step.overdue ? `Overdue: was due by ${due}` : `Due by ${due}`;
}

function StepIcon({ step }: { readonly step: TimelineStep }) {
  if (step.done) return <CircleCheck aria-hidden="true" className="size-5 text-accent" />;
  if (step.overdue) return <CircleAlert aria-hidden="true" className="size-5 text-danger" />;
  return <Circle aria-hidden="true" className="size-5 text-muted" />;
}

/** The status timeline with its legal deadlines (7 days, 3 months by default). */
export function CaseTimeline({ steps }: { readonly steps: readonly TimelineStep[] }) {
  return (
    <ol className="mt-4 space-y-3" aria-label="Case timeline">
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-3">
          <StepIcon step={step} />
          <div>
            <p className="font-semibold">{STEP_LABELS[step.id]}</p>
            <p className="text-muted">{stepDetail(step)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
