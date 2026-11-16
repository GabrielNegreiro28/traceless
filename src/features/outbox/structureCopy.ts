import type { InferenceSourceKind } from '../../application/ports/IdentityScanner';
import type { ReportCategory } from '../../domain/report/structuredReport';
import type { SourceVariant } from '../../ui';

/** Copy for the structured card (structureReport). Never includes report text. */

export const STRUCTURE_HEADING = 'What the organization will receive';
export const STRUCTURE_LOADING = 'Organizing your approved text…';
export const STRUCTURE_FAILED = 'Couldn’t organize the report — you can still send it.';
export const STRUCTURE_NOTE =
  'Made only from your approved text. The category is sent with it; the summary, when and where are a preview for you to check.';
export const NOT_STATED = 'Not stated';

export const REPORT_CATEGORY_LABELS: Readonly<Record<ReportCategory, string>> = {
  harassment: 'Harassment',
  fraud: 'Fraud or financial misconduct',
  safety: 'Health and safety',
  discrimination: 'Discrimination',
  retaliation: 'Retaliation',
  other: 'Other',
};

/** Where the card was made: the real inference source, or the demo organizer (never AI). */
export function structureBadge(
  source: InferenceSourceKind,
  demo: boolean,
): { readonly variant: SourceVariant; readonly label: string } {
  if (demo) return { variant: 'rules', label: 'Organized by the demo organizer (no AI)' };
  return source === 'ON_DEVICE'
    ? { variant: 'onDevice', label: 'Organized on your device' }
    : { variant: 'cloud', label: 'Organized in the cloud — only your approved text' };
}
