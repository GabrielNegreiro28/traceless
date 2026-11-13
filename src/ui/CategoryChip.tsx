import type { FindingCategory } from '../domain/detection/types';
import { Badge } from './Badge';
import { CATEGORY_LABELS } from './categoryLabels';

/** Category of a finding. Red is reserved for direct identifiers; the rest use amber. */
export function CategoryChip(props: { readonly category: FindingCategory }) {
  const tone = props.category === 'DIRECT_IDENTIFIER' ? 'danger' : 'warning';
  return <Badge tone={tone}>{CATEGORY_LABELS[props.category]}</Badge>;
}
