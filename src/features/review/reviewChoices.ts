import type { ReviewChoice } from '../../domain/rewrite/reviewDecision';

/** The reporter's choices with the label announced to assistive technology. */
export interface LabeledChoice {
  readonly choice: ReviewChoice;
  readonly label: string;
}

export const ACCEPT: LabeledChoice = { choice: { action: 'ACCEPTED' }, label: 'Accepted' };
export const KEEP: LabeledChoice = { choice: { action: 'KEPT_RISK' }, label: 'Kept anyway' };
export const NOT_ABOUT_ME: LabeledChoice = {
  choice: { action: 'NOT_ABOUT_ME' },
  label: 'Marked as not about you',
};

export function editChoice(replacement: string): LabeledChoice {
  return { choice: { action: 'EDITED', replacement }, label: 'Edited' };
}
