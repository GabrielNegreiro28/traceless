import { useId, useState, type FormEvent } from 'react';
import type { CaseRecord } from '../../application/ports/ReportRepository';
import { buildCaseTimeline, type DeadlineSettings } from '../../domain/case/caseTimeline';
import { Button, Card } from '../../ui';
import { ReportText } from '../outbox/ReportText';
import { CaseTimeline } from './CaseTimeline';
import { lookupErrorMessage } from './followupCopy';
import { useCaseLookup, type CaseLookupState } from './useCaseLookup';

interface CaseDetailsProps {
  readonly record: CaseRecord;
  readonly deadlines: DeadlineSettings;
  readonly readAt: number;
}

function CaseDetails({ record, deadlines, readAt }: CaseDetailsProps) {
  const steps = buildCaseTimeline(record.createdAt, record.status, deadlines, readAt);
  return (
    <section aria-labelledby="case-status-heading" className="mt-8">
      <h2 id="case-status-heading" className="text-2xl font-bold tracking-tight">
        Case status
      </h2>
      <CaseTimeline steps={steps} />
      <h2 className="mt-8 text-2xl font-bold tracking-tight">What you sent</h2>
      <div className="mt-3">
        <ReportText text={record.sanitizedText} label="Submitted text" />
      </div>
    </section>
  );
}

function LookupResult({ state }: { readonly state: CaseLookupState }) {
  switch (state.status) {
    case 'idle':
    case 'loading':
      return null;
    case 'failed':
      return (
        <p role="alert" className="mt-6 text-lg">
          {lookupErrorMessage(state.error.kind)}
        </p>
      );
    case 'found':
      return (
        <CaseDetails record={state.record} deadlines={state.deadlines} readAt={state.readAt} />
      );
  }
}

/**
 * /case: the read-only follow-up. The reporter types the case key they saved; the page shows
 * when the report was received, the status timeline with its deadlines and the text sent.
 * The key is kept only in this page's memory (no storage, no URL, no browser autofill).
 */
export function CaseLookupPage() {
  const { state, lookUp } = useCaseLookup();
  const [input, setInput] = useState('');
  const inputId = useId();
  const hintId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (input.trim() !== '') lookUp(input);
  };
  return (
    <section className="max-w-2xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Follow up on your case
      </h1>
      <p className="mt-4 text-lg">
        Enter the case key you saved when you sent your report. No account needed.
      </p>
      <Card className="mt-6">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor={inputId} className="font-semibold">
            Case key
          </label>
          <input
            id={inputId}
            aria-describedby={hintId}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
            className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-lg"
          />
          <p id={hintId} className="text-sm text-muted">
            22 letters and numbers. Spaces are fine; capital letters matter.
          </p>
          <div>
            <Button type="submit" loading={state.status === 'loading'}>
              Look up case
            </Button>
          </div>
        </form>
      </Card>
      <LookupResult state={state} />
    </section>
  );
}
