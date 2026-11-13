import type { FindingCategory } from '../domain/detection/types';

/** Reporter-facing names of the finding categories. */
export const CATEGORY_LABELS: Readonly<Record<FindingCategory, string>> = {
  ROLE_UNIQUE: 'Unique role',
  SCHEDULE: 'Schedule',
  LOCATION: 'Location',
  PERSONAL_EVENT_DATE: 'Personal date',
  PERSONAL_TRAIT: 'Personal trait',
  TEAM_SIZE: 'Team size',
  DIRECT_IDENTIFIER: 'Direct identifier',
  WRITING_STYLE: 'Writing style',
};
