import { groupCaseKey, type CaseKey } from '../../domain/case/caseKey';

export const CASE_KEY_FILE_NAME = 'traceless-case-key.txt';

/** The .txt the reporter saves: the key, where to use it, and that it must stay private. */
export function caseKeyFileText(caseKey: CaseKey, origin: string): string {
  return [
    'Traceless case key',
    '',
    groupCaseKey(caseKey).join(' '),
    '',
    `Follow up at ${origin}/case`,
    'Anyone with this key can read your case. Keep it private.',
    '',
  ].join('\n');
}
