import { useId } from 'react';
import {
  REPORT_CATEGORIES,
  isReportCategory,
  type StructuredReport,
} from '../../domain/report/structuredReport';
import { Card, SourceBadge } from '../../ui';
import {
  NOT_STATED,
  REPORT_CATEGORY_LABELS,
  STRUCTURE_FAILED,
  STRUCTURE_HEADING,
  STRUCTURE_LOADING,
  STRUCTURE_NOTE,
  structureBadge,
} from './structureCopy';
import type { ReportStructureView } from './useReportStructure';

export interface StructuredReportCardProps {
  readonly structure: ReportStructureView;
  /** True when the demo structurer stood in for the AI (never labelled as AI). */
  readonly demo: boolean;
  /** While sending, the category can no longer change. */
  readonly disabled?: boolean;
}

function Field(props: { readonly label: string; readonly value: string | null }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted">{props.label}</dt>
      <dd>{props.value ?? NOT_STATED}</dd>
    </div>
  );
}

function CategorySelect(props: {
  readonly structure: ReportStructureView;
  readonly disabled: boolean;
}) {
  const id = useId();
  const { category, setCategory } = props.structure;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        Category
      </label>
      <select
        id={id}
        value={category ?? 'other'}
        disabled={props.disabled}
        onChange={(event) => {
          if (isReportCategory(event.target.value)) setCategory(event.target.value);
        }}
        className="mt-1 block rounded-md border border-border bg-bg px-2 py-1"
      >
        {REPORT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {REPORT_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
    </div>
  );
}

function Details(props: { readonly report: StructuredReport }) {
  return (
    <dl className="mt-3 grid gap-3">
      <Field label="Summary" value={props.report.summary} />
      <Field label="When" value={props.report.when} />
      <Field label="Where" value={props.report.where} />
    </dl>
  );
}

/**
 * "What the organization will receive": the structureReport result for the approved text,
 * with a badge from where the model really ran (inferenceSource) and an editable category.
 * Optional by design: loading and failure states never block "Send to organization".
 */
export function StructuredReportCard({
  structure,
  demo,
  disabled = false,
}: StructuredReportCardProps) {
  const headingId = useId();
  const { status, report, source } = structure;
  return (
    <Card aria-labelledby={headingId} role="region">
      <h2 id={headingId} className="text-lg font-semibold">
        {STRUCTURE_HEADING}
      </h2>
      <div aria-live="polite">
        {status === 'loading' && <p className="mt-2 text-muted">{STRUCTURE_LOADING}</p>}
        {status === 'failed' && <p className="mt-2 text-muted">{STRUCTURE_FAILED}</p>}
        {status === 'ready' && report !== null && source !== null && (
          <div className="mt-2">
            <SourceBadge {...structureBadge(source, demo)} />
            <div className="mt-3">
              <CategorySelect structure={structure} disabled={disabled} />
            </div>
            <Details report={report} />
            <p className="mt-3 text-sm text-muted">{STRUCTURE_NOTE}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
