import { useId } from 'react';
import type { Finding } from '../../domain/detection/types';
import type { ReviewDecision } from '../../domain/rewrite/reviewDecision';
import { Badge, Button, CategoryChip, SourceBadge } from '../../ui';
import { cx } from '../../ui/cx';
import { FindingActions } from './FindingActions';
import { replacementLabel, STATE_LABELS, type FindingState } from './reviewModel';
import type { SourceLabel } from './scanSource';
import { SuggestionEditor } from './SuggestionEditor';

export interface FindingCardProps {
  readonly finding: Finding;
  /** How a MODEL finding's origin reads, from the scan that found it (see scanSource.ts). */
  readonly modelBadge: SourceLabel;
  readonly decision: ReviewDecision | undefined;
  /** Includes `covered`: the finding disappears inside a wider change. */
  readonly state: FindingState;
  /** What the rewrite puts where this finding's change is (the applier's own plan). */
  readonly replacement: string | undefined;
  readonly selected: boolean;
  readonly editing: boolean;
  /** How many other identical quotes received this decision. */
  readonly identical: number;
  readonly onSelect: () => void;
  readonly onAccept: () => void;
  readonly onStartEdit: () => void;
  readonly onSaveEdit: (replacement: string) => void;
  readonly onCancelEdit: () => void;
  readonly onKeep: () => void;
  readonly onNotAboutMe: () => void;
  readonly onUndo: () => void;
}

const isBlank = (value: string | null | undefined): boolean => (value ?? '').trim() === '';

function suggestionText(finding: Finding): string {
  return isBlank(finding.suggestion)
    ? 'Suggested: remove this detail.'
    : `Suggested: “${finding.suggestion ?? ''}”`;
}

function outcomeText(props: FindingCardProps): string {
  switch (props.state) {
    case 'accepted':
    case 'edited':
      return props.replacement === undefined || replacementLabel(props.replacement) === '(removed)'
        ? 'This detail will be removed.'
        : `This detail will become “${props.replacement}”.`;
    case 'kept':
      return 'Kept as written. It still counts toward your risk.';
    case 'notAboutMe':
      return 'Left as written. It no longer counts toward your risk.';
    case 'covered':
      return 'This detail sits inside a wider change you made, so it is removed with it. Undo that change to decide about this one.';
    case 'pending':
      return '';
  }
}

/**
 * A RULE finding may be a model span the merger relabeled (it swallowed a rule match), so in an
 * AI scan the chip says "Rules + AI"; only the demo scanner or a basic check is rules alone.
 */
function Origin(props: { readonly origin: Finding['origin']; readonly modelBadge: SourceLabel }) {
  const { origin, modelBadge } = props;
  if (origin === 'MODEL')
    return <SourceBadge variant={modelBadge.variant} label={modelBadge.label} />;
  const aiScan = modelBadge.variant !== 'rules';
  return <SourceBadge variant="rules" {...(aiScan && { label: 'Rules + AI' })} />;
}

function Resolved(props: FindingCardProps) {
  const { state, identical, decision } = props;
  const copied = decision?.propagatedFrom !== undefined;
  return (
    <div className="mt-3">
      <p>{outcomeText(props)}</p>
      {identical > 0 && state !== 'covered' && (
        <p className="mt-1 text-sm text-muted">
          Also applied to {identical} identical {identical === 1 ? 'mention' : 'mentions'}.
        </p>
      )}
      {copied && state !== 'covered' && (
        <p className="mt-1 text-sm text-muted">Applied because the same words appear elsewhere.</p>
      )}
      {state !== 'covered' && (
        <div className="mt-2">
          <Button variant="secondary" onClick={props.onUndo}>
            Undo
          </Button>
        </div>
      )}
    </div>
  );
}

function Pending(props: FindingCardProps) {
  const { finding } = props;
  if (props.editing) {
    return (
      <SuggestionEditor
        initial={finding.suggestion ?? ''}
        quote={finding.quote}
        onSave={props.onSaveEdit}
        onCancel={props.onCancelEdit}
      />
    );
  }
  return (
    <>
      <p className="mt-2 text-sm">{suggestionText(finding)}</p>
      <FindingActions
        quote={finding.quote}
        onAccept={props.onAccept}
        onStartEdit={props.onStartEdit}
        onKeep={props.onKeep}
        onNotAboutMe={props.onNotAboutMe}
      />
    </>
  );
}

/** One finding: what was found, why it matters, and the actions to resolve it. */
export function FindingCard(props: FindingCardProps) {
  const { finding, selected, state } = props;
  const titleId = useId();
  return (
    <article
      id={`finding-${finding.id}`}
      data-finding-id={finding.id}
      aria-labelledby={titleId}
      aria-current={selected || undefined}
      tabIndex={-1}
      onFocus={props.onSelect}
      className={cx(
        'scroll-my-2 rounded-md border bg-surface p-4 min-[769px]:scroll-mb-24 min-[769px]:scroll-mt-40',
        selected ? 'border-text outline outline-2 outline-text' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CategoryChip category={finding.category} />
        <Origin origin={finding.origin} modelBadge={props.modelBadge} />
        {state !== 'pending' && <Badge tone="accent">{STATE_LABELS[state]}</Badge>}
      </div>
      <blockquote
        id={titleId}
        className="mt-3 border-l-2 border-border pl-3 text-base font-semibold"
      >
        &ldquo;{finding.quote}&rdquo;
      </blockquote>
      <p className="mt-2 text-sm text-muted">{finding.reason}</p>
      {state === 'pending' ? <Pending {...props} /> : <Resolved {...props} />}
    </article>
  );
}
