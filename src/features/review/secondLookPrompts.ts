import type { FindingCategory } from '../../domain/detection/types';

/** One plain-English question per category, for the reporter's own final check. */
export const SECOND_LOOK_PROMPTS: Readonly<Record<FindingCategory, string>> = {
  ROLE_UNIQUE: 'Does your text mention a job title or role that only a few people have?',
  SCHEDULE: 'Does your text mention your shift or the days you work?',
  LOCATION: 'Does your text name a site, room, building or town where you work?',
  PERSONAL_EVENT_DATE:
    'Does your text mention dates tied to you, such as a start date, leave or an appointment?',
  PERSONAL_TRAIT: 'Does your text describe you, such as your age, health, language or background?',
  TEAM_SIZE: 'Does your text say how many people are on your team or shift?',
  DIRECT_IDENTIFIER:
    'Does your text include your name, email address, phone number or employee ID?',
  WRITING_STYLE: 'Would coworkers recognize how you write, such as a sign-off or favorite phrases?',
};
