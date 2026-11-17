import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { scoreRisk } from '../../domain/risk/riskScorer';
import { TEXT, reviewing } from './reportFlowTestKit';
import { cardOf, click, renderReview, secondLookBox, spies } from './reviewScreenTestKit';

describe('ReviewScreen second look, protected mentions and empty state', () => {
  it('lists all eight categories with the final-check copy', () => {
    renderReview();
    expect(
      screen.getByText(/Traceless can miss or misjudge details; you are the final check\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Does your text mention your shift or the days you work?'),
    ).toBeInTheDocument();
    const second = screen.getByText('Second look').closest('details');
    expect(second?.querySelectorAll('li')).toHaveLength(8);
    expect(second).not.toHaveAttribute('open');
  });

  it('shows protected mentions as a collapsed, display-only list of chips', () => {
    const start = TEXT.indexOf('Mr. Alvarez');
    const second = TEXT.indexOf('Mr. Alvarez', start + 1);
    const spans = [
      { start, end: start + 'Mr. Alvarez'.length },
      { start: second, end: second + 'Mr. Alvarez'.length },
    ];
    renderReview({ ...reviewing, protectedSpans: spans });
    const details = screen
      .getByText('Kept as written (looks like other people, not you)')
      .closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(within(details as HTMLElement).getAllByRole('listitem')).toHaveLength(1);
    expect(within(details as HTMLElement).getByText('Mr. Alvarez')).toBeInTheDocument();
    expect(
      within(details as HTMLElement).getByText(
        /If one of these is actually about you, use Back to edit to change it\./,
      ),
    ).toBeInTheDocument();
    expect(within(details as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('hides the protected list when there are none', () => {
    renderReview();
    expect(screen.queryByText(/Kept as written/)).toBeNull();
  });

  it('shows the empty state with an open second look and Continue', async () => {
    renderReview({ ...reviewing, findings: [], risk: scoreRisk([]) });
    expect(screen.getByText('No details flagged.')).toBeVisible();
    expect(screen.getByText('Second look').closest('details')).toHaveAttribute('open');
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByText(/still undecided/)).toBeNull();
    await userEvent.click(secondLookBox());
    await click('Continue');
    expect(spies.onContinue).toHaveBeenCalledTimes(1);
  });

  it.each(['full', 'cloud', 'basic'] as const)(
    'blocks Continue until the Second look is confirmed (%s checks)',
    async (checks) => {
      renderReview({ ...reviewing, checks });
      const next = screen.getByRole('button', { name: 'Continue' });
      expect(next).toBeDisabled();
      expect(next).toHaveAccessibleDescription('Confirm the Second look to continue.');
      expect(secondLookBox()).not.toBeChecked();
      await userEvent.click(secondLookBox());
      expect(next).toBeEnabled();
      expect(screen.queryByText('Confirm the Second look to continue.')).toBeNull();
      await userEvent.click(secondLookBox());
      expect(next).toBeDisabled();
    },
  );

  it('confirms with the keyboard (Tab to the box, Space)', async () => {
    renderReview();
    secondLookBox().focus();
    await userEvent.keyboard(' ');
    expect(secondLookBox()).toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});

describe('ReviewScreen layout', () => {
  it('shows the heading, the keyboard hint, the live risk and one card per finding', () => {
    renderReview();
    expect(screen.getByRole('heading', { level: 1, name: 'Review your report' })).toBeVisible();
    expect(
      screen.getByText('When a card is focused: A accept, E edit, K keep, N not about me'),
    ).toBeVisible();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'Risk: high');
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.getByText(/Biggest contributors: .+\./)).toBeVisible();
  });

  it('announces risk changes once: only the screen status is a live region', () => {
    renderReview();
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('is sticky only on wide screens, so it cannot cover the focused card at 360 px', () => {
    renderReview();
    const sticky = Array.from(document.querySelectorAll('[class*="sticky"]'));
    expect(sticky).toHaveLength(2);
    for (const el of sticky) {
      expect(el.className).not.toMatch(/(^|\s)sticky/);
      expect(el.className).toContain('min-[769px]:sticky');
    }
    expect(cardOf('Dock B').className).toContain('scroll-mt-40');
  });

  it('never offers "accept all"', () => {
    renderReview();
    expect(screen.queryByRole('button', { name: /all/i })).toBeNull();
  });

  it('orders the cards like the text and labels their origin', () => {
    renderReview();
    const quotes = screen.getAllByRole('article').map((c) => within(c).getByRole('blockquote'));
    expect(quotes.map((q) => q.textContent)).toEqual([
      '“the night lead”',
      '“Dock B”',
      '“Mr. Alvarez”',
      '“Mr. Alvarez”',
    ]);
    expect(within(cardOf('Dock B')).getByText('On-device AI')).toBeVisible();
  });

  it('shows rule findings with the rules-and-AI badge in an AI scan', () => {
    const ruleFinding = { ...reviewing.findings[1], origin: 'RULE' as const };
    renderReview({ ...reviewing, findings: [ruleFinding] as typeof reviewing.findings });
    expect(within(cardOf('Dock B')).getByText('Rules + AI')).toBeVisible();
  });

  it('marks every finding in the text with a hidden category label, never color alone', () => {
    renderReview();
    const marks = document.querySelectorAll('mark');
    expect(marks).toHaveLength(4);
    expect(marks[0]).toHaveTextContent('[Unique role: undecided]');
    expect(marks[0]).toHaveAttribute('data-state', 'pending');
    expect(document.body).toHaveTextContent('Wavy underline: undecided.');
  });

  it('clicking a mark selects its card', async () => {
    renderReview();
    expect(cardOf('the night lead')).toHaveAttribute('aria-current', 'true');
    await click(/^Dock B\s*\[Location/);
    expect(cardOf('Dock B')).toHaveAttribute('aria-current', 'true');
    expect(cardOf('the night lead')).not.toHaveAttribute('aria-current');
  });

  it('keeps overlapping findings usable: one mark, clicking again cycles the finding', async () => {
    const [role, dock] = reviewing.findings;
    const wide = {
      ...dock,
      id: 'wide',
      span: { start: role?.span.start ?? 0, end: dock?.span.end ?? 0 },
      quote: 'the night lead at Dock B',
    };
    renderReview({ ...reviewing, findings: [role, dock, wide] as typeof reviewing.findings });
    const overlap = screen.getByRole('button', { name: /^the night lead\s*\[Unique role and/ });
    expect(document.querySelectorAll('mark')).toHaveLength(3);
    expect(cardOf('the night lead')).toHaveAttribute('aria-current', 'true');
    await userEvent.click(overlap);
    expect(cardOf('the night lead at Dock B')).toHaveAttribute('aria-current', 'true');
    await userEvent.click(overlap);
    expect(cardOf('the night lead')).toHaveAttribute('aria-current', 'true');
  });
});
