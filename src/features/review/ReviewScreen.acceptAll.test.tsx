import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mergeFindings } from '../../domain/detection/findingMerger';
import { detectByRules } from '../../domain/detection/ruleDetector';
import type { Finding } from '../../domain/detection/types';
import { SAMPLE_REPORT } from '../../domain/report/sampleReport';
import { findingOf } from '../../domain/rewrite/rewriteTestKit';
import { scoreRisk } from '../../domain/risk/riskScorer';
import { toRawText } from '../../domain/text/brandedText';
import { renderReview } from './reviewScreenTestKit';

/**
 * Regression from the cloud-mode walkthrough of the sample report: after accepting every
 * card the outbox still said "Risk: high". Model findings like the cloud's overlap the rule
 * findings (same category partly, other categories inside wider ones, a repeated quote).
 */

const model = (quote: string, category: Finding['category'], suggestion: string | null) =>
  findingOf(SAMPLE_REPORT, quote, { category, suggestion, id: `model:${quote}:${category}` });

const CLOUD_LIKE_FINDINGS = mergeFindings([
  ...detectByRules(toRawText(SAMPLE_REPORT), 'core+firstPerson'),
  model('only night-shift forklift trainer', 'ROLE_UNIQUE', 'a trainer'),
  model('Halvern Freight depot in Brackenford, Dock 4', 'LOCATION', 'a company location'),
  model('forklift trainer at the Halvern Freight depot', 'LOCATION', 'a worker at a site'),
  model('held this job for six years', 'PERSONAL_TRAIT', 'for some time'),
  model('Tuesday to Saturday, from 10 p.m. to 6 a.m', 'SCHEDULE', 'some shifts'),
  model('I sign the dock safety checklist', 'PERSONAL_TRAIT', 'I follow procedures'),
  model('my name is on the logs for both nights', 'DIRECT_IDENTIFIER', null),
  model('the tired trainer on the night shift', 'ROLE_UNIQUE', 'a concerned employee'),
  model('night shift', 'SCHEDULE', 'a shift'),
]);

describe('ReviewScreen: accepting every card', () => {
  it('leaves no residual risk when overlapping findings are all accepted or covered', async () => {
    renderReview({
      status: 'reviewing',
      text: toRawText(SAMPLE_REPORT),
      checks: 'cloud',
      findings: CLOUD_LIKE_FINDINGS,
      protectedSpans: [],
      decisions: [],
      risk: scoreRisk(CLOUD_LIKE_FINDINGS),
    });
    expect(screen.getByText(/Risk: high/)).toBeVisible();

    let accepted = 0;
    for (let button = screen.queryAllByRole('button', { name: 'Accept' })[0]; button;) {
      await userEvent.click(button);
      accepted += 1;
      button = screen.queryAllByRole('button', { name: 'Accept' })[0];
    }

    expect(accepted).toBeGreaterThan(0);
    expect(screen.queryByText(/still undecided/)).toBeNull();
    expect(screen.queryByText(/Risk: (high|medium|low)/)).toBeNull();
    expect(screen.getAllByText(/Risk: none/).length).toBeGreaterThan(0);
  });
});
