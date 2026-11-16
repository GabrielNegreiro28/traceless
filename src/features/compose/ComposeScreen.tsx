import { useId, useRef } from 'react';
import { isUnmodifiedSample } from '../../domain/report/sampleReport';
import { Button } from '../../ui';
import { DEMO_ORG_NAME, MAX_REPORT_CHARS } from './reportLimits';
import { SAMPLE_REPORT } from './sampleReport';

export interface ComposeScreenProps {
  readonly text: string;
  readonly onTextChange: (text: string) => void;
  readonly onCheck: () => void;
  /** True while the device is being checked; the button stays focusable but inert. */
  readonly checking?: boolean;
}

const formatCount = (n: number): string => n.toLocaleString('en-US');

/**
 * Presentational composer: the report field, helper copy, sample and "Check" actions. The
 * sample button is hidden while the field already holds the unmodified sample.
 */
export function ComposeScreen({
  text,
  onTextChange,
  onCheck,
  checking = false,
}: ComposeScreenProps) {
  const fieldId = useId();
  const helpId = `${fieldId}-help`;
  const counterId = `${fieldId}-count`;
  const atLimit = text.length >= MAX_REPORT_CHARS;
  const field = useRef<HTMLTextAreaElement>(null);
  const loadSample = () => {
    onTextChange(SAMPLE_REPORT);
    // The button disappears once the sample is loaded: keep focus on the text, not the body.
    field.current?.focus();
  };
  return (
    <section className="max-w-3xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        Write your report
      </h1>
      <ul id={helpId} className="mt-3 space-y-1 text-muted">
        <li>Demo organization: {DEMO_ORG_NAME} (fictional)</li>
        <li>English only for now</li>
        <li>
          On supported Chrome, your text is checked on your device. Elsewhere, nothing is sent
          unless you explicitly agree.
        </li>
      </ul>
      <label htmlFor={fieldId} className="mt-6 block text-lg font-semibold">
        Your report
      </label>
      <textarea
        ref={field}
        id={fieldId}
        value={text}
        maxLength={MAX_REPORT_CHARS}
        rows={14}
        spellCheck
        onChange={(e) => onTextChange(e.target.value.slice(0, MAX_REPORT_CHARS))}
        aria-describedby={`${helpId} ${counterId}`}
        className="mt-2 block w-full rounded-md border border-border bg-surface p-3 text-base leading-relaxed text-text"
      />
      <p id={counterId} className="mt-1 text-sm text-muted">
        {formatCount(text.length)} / {formatCount(MAX_REPORT_CHARS)} characters
      </p>
      <p role="status" className="text-sm text-warning">
        {atLimit ? `You reached the ${formatCount(MAX_REPORT_CHARS)}-character limit.` : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={onCheck} loading={checking} disabled={text.trim() === ''}>
          Check my report
        </Button>
        {!isUnmodifiedSample(text) && (
          <Button variant="secondary" onClick={loadSample}>
            Try a sample report
          </Button>
        )}
      </div>
    </section>
  );
}
