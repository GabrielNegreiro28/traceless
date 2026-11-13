import { spanContains } from '../detection/span';
import type { Finding, TextSpan } from '../detection/types';
import { clusterEdits, planEdits, type EditCluster } from './editPlan';
import type { ReviewDecision } from './reviewDecision';

/** A change the rewrite will make, with the findings that asked for it. */
export interface PreviewCluster extends EditCluster {
  /** Findings with an ACCEPTED/EDITED decision inside this change (the primary is one). */
  readonly memberIds: readonly string[];
}

export interface RewritePreview {
  /** The changes in text order; they never overlap. */
  readonly clusters: readonly PreviewCluster[];
  /**
   * Findings that disappear inside a change they did not ask for (their own decision, if any,
   * is not ACCEPTED/EDITED). Maps the finding id to the id of that change's primary finding.
   * The same containment rule remainingFindings uses, so the UI and the risk agree.
   */
  readonly covered: ReadonlyMap<string, string>;
}

const EMPTY: RewritePreview = { clusters: [], covered: new Map() };

function memberIdsOf(
  span: TextSpan,
  edits: readonly { readonly findingId: string; readonly span: TextSpan }[],
): string[] {
  return edits.filter((e) => spanContains(span, e.span)).map((e) => e.findingId);
}

/**
 * What the applier will do, for showing it before it happens (pure). Built from the same
 * planEdits/clusterEdits as applyDecisions, so a cluster's span and replacement are exactly
 * what the rewrite uses. An invalid plan (unknown id, stale finding...) yields an empty
 * preview; the applier reports that error itself.
 */
export function previewClusters(
  text: string,
  findings: readonly Finding[],
  decisions: readonly ReviewDecision[],
): RewritePreview {
  const plan = planEdits(text, findings, decisions);
  if (!plan.ok) return EMPTY;
  const clusters = clusterEdits(plan.value).map((cluster) => ({
    ...cluster,
    memberIds: memberIdsOf(cluster.span, plan.value),
  }));
  const covered = new Map<string, string>();
  for (const finding of findings) {
    const cluster = clusters.find((c) => spanContains(c.span, finding.span));
    if (cluster !== undefined && !cluster.memberIds.includes(finding.id)) {
      covered.set(finding.id, cluster.primaryId);
    }
  }
  return { clusters, covered };
}

/** The change that contains this finding (as a member or as a covered finding), if any. */
export function clusterContaining(
  preview: RewritePreview,
  finding: Finding,
): PreviewCluster | undefined {
  return preview.clusters.find((c) => spanContains(c.span, finding.span));
}
