import type { Finding } from '../../domain/detection/types';
import type { PreviewCluster, RewritePreview } from '../../domain/rewrite/previewClusters';
import { CATEGORY_LABELS, VisuallyHidden } from '../../ui';
import { cx } from '../../ui/cx';
import { buildSegments, type Segment } from './buildSegments';
import { pickTarget, replacementLabel, type FindingState } from './reviewModel';

/**
 * The report text with every finding as a <mark>. Each state has its own underline style, so
 * nothing relies on color alone, and a hidden label names the category and the state:
 * - undecided: wavy underline; kept anyway: double underline; not about me: dotted underline;
 * - changed text: whatever the rewrite will replace is struck through (<del>), also when the
 *   change comes from a wider overlapping finding, and the real replacement follows the change
 *   once (<ins>, or "(removed)"). Both come from previewClusters, the applier's own plan.
 * Overlapping findings share one mark (see buildSegments); activating it again cycles through
 * the findings that cover it, and moves focus to the card.
 */

const STATE_CLASSES: Readonly<Record<FindingState, string>> = {
  pending:
    'bg-warning-soft underline decoration-warning decoration-wavy decoration-2 underline-offset-4',
  accepted: 'bg-accent-soft',
  edited: 'bg-accent-soft',
  covered: 'bg-accent-soft',
  kept: 'bg-warning-soft underline decoration-warning decoration-double decoration-2 underline-offset-4',
  notAboutMe: 'underline decoration-muted decoration-dotted decoration-2 underline-offset-4',
};

/** The state as read aloud inside a mark. */
const STATE_WORDS: Readonly<Record<FindingState, string>> = {
  pending: 'undecided',
  accepted: 'accepted',
  edited: 'edited',
  kept: 'kept anyway',
  notAboutMe: 'not about me',
  covered: 'will change',
};

const SELECTED = 'rounded-sm outline outline-2 outline-offset-2 outline-text';

export interface HighlightedTextProps {
  readonly text: string;
  readonly findings: readonly Finding[];
  readonly preview: RewritePreview;
  readonly states: ReadonlyMap<string, FindingState>;
  readonly selectedId: string | null;
  /** A mark was activated: select the card and move focus to it. */
  readonly onActivate: (findingId: string) => void;
}

const changes = (cluster: PreviewCluster, segment: Segment): boolean =>
  cluster.span.start <= segment.start && segment.end <= cluster.span.end;

/** The change whose end falls inside this segment (segments partition the text). */
const endsIn = (cluster: PreviewCluster, segment: Segment): boolean =>
  segment.start < cluster.span.end && cluster.span.end <= segment.end;

function labelFor(
  ids: readonly string[],
  byId: ReadonlyMap<string, Finding>,
  state: FindingState,
): string {
  const names = ids.map((id) => {
    const finding = byId.get(id);
    return finding === undefined ? '' : CATEGORY_LABELS[finding.category];
  });
  return `[${names.filter(Boolean).join(' and ')}: ${STATE_WORDS[state]}]`;
}

/** A segment inside a change reads as changed even when its own finding is still pending. */
function visualState(own: FindingState | undefined, changed: boolean): FindingState {
  if (!changed) return own ?? 'pending';
  return own === 'accepted' || own === 'edited' ? own : 'covered';
}

interface MarkProps {
  readonly segment: Segment;
  readonly byId: ReadonlyMap<string, Finding>;
  readonly changed: boolean;
  readonly states: ReadonlyMap<string, FindingState>;
  readonly selectedId: string | null;
  readonly onActivate: (findingId: string) => void;
}

function SegmentMark({ segment, byId, changed, states, selectedId, onActivate }: MarkProps) {
  const primaryId = segment.findingIds[0];
  if (primaryId === undefined) return <>{segment.text}</>;
  const state = visualState(states.get(primaryId), changed);
  const selected = selectedId !== null && segment.findingIds.includes(selectedId);
  return (
    <mark
      data-state={state}
      data-selected={selected || undefined}
      className={cx('text-text', STATE_CLASSES[state], selected && SELECTED)}
    >
      <button
        type="button"
        onClick={() => {
          const target = pickTarget(segment.findingIds, selectedId);
          if (target !== undefined) onActivate(target);
        }}
        className="inline cursor-pointer text-left [font:inherit]"
      >
        {changed ? <del>{segment.text}</del> : segment.text}
        <VisuallyHidden>{labelFor(segment.findingIds, byId, state)}</VisuallyHidden>
      </button>
    </mark>
  );
}

export function HighlightedText(props: HighlightedTextProps) {
  const byId = new Map(props.findings.map((f) => [f.id, f]));
  const segments = buildSegments(props.text, props.findings);
  return (
    <section aria-labelledby="report-text-heading">
      <h2 id="report-text-heading" className="text-lg font-semibold">
        Your report
      </h2>
      <p className="mt-1 text-sm text-muted">
        Wavy underline: undecided. Double: kept anyway. Dotted: not about you. Struck through: will
        change.
      </p>
      <p className="mt-3 max-w-[68ch] whitespace-pre-wrap break-words text-lg leading-[1.6]">
        {segments.map((segment) => (
          <span key={segment.start}>
            <SegmentMark
              segment={segment}
              byId={byId}
              changed={props.preview.clusters.some((c) => changes(c, segment))}
              states={props.states}
              selectedId={props.selectedId}
              onActivate={props.onActivate}
            />
            {props.preview.clusters
              .filter((c) => endsIn(c, segment))
              .map((c) => (
                <ins key={c.primaryId} className="ml-1 font-semibold no-underline">
                  {replacementLabel(c.replacement)}
                </ins>
              ))}
          </span>
        ))}
      </p>
    </section>
  );
}
