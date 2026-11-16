import { SECOND_LOOK_CONFIRM_LABEL } from '../features/review/SecondLook';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { scanReport } from '../application/usecases/scanReport';
import type { ModelFinding } from '../domain/detection/types';
import { SAMPLE_REPORT } from '../features/compose/sampleReport';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import type { Services } from './compositionRoot';
import { createAppRoutes } from './router';
import { renderWithServices } from './services/renderWithServices';

const MODEL_FINDINGS: readonly ModelFinding[] = [
  {
    quote: 'only night-shift forklift trainer',
    category: 'ROLE_UNIQUE',
    reason: 'Very few people hold this exact role.',
    suggestion: 'a forklift trainer',
  },
  {
    quote: 'Tuesday to Saturday, from 10 p.m. to 6 a.m.',
    category: 'SCHEDULE',
    reason: 'Your shift pattern narrows down who you are.',
    suggestion: 'during my shifts',
  },
  {
    quote: 'Brackenford',
    category: 'LOCATION',
    reason: 'A small town identifies the site.',
    suggestion: null,
  },
];

/** The real scan use case over the composition root's fake scanner (no infrastructure in features). */
function scannerServices(): {
  readonly services: Partial<Services>;
  readonly scan: ReturnType<typeof vi.fn>;
} {
  const scanner = new FakeIdentityScanner({
    respond: () => ({ findings: MODEL_FINDINGS, protectedQuotes: ['Gary Pemberton'] }),
  });
  const scan = vi.fn();
  const run: Services['scanReport'] = (text, onProgress, isCancelled) => {
    scan();
    return scanReport(
      text,
      {
        scanner,
        clock: { now: () => 0 },
        chunkChars: 10_000,
        postFilters: ['protectedMentions'],
      },
      {
        ...(onProgress === undefined ? {} : { onProgress }),
        ...(isCancelled === undefined ? {} : { isCancelled }),
      },
    );
  };
  return { services: { identityScanner: scanner, scanReport: run }, scan };
}

function openReport(overrides: Partial<Services>) {
  const router = createMemoryRouter(createAppRoutes([]), { initialEntries: ['/report'] });
  return renderWithServices(<RouterProvider router={router} />, overrides);
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

async function reachReview(overrides: Partial<Services>): Promise<void> {
  openReport(overrides);
  await heading('Write your report');
  await click('Try a sample report');
  await click('Check my report');
  await heading('Review your report');
}

describe('/report review on fake services', () => {
  it('goes sample, scan, review, decide every card, Continue, outbox', async () => {
    const { services } = scannerServices();
    await reachReview(services);
    const cards = screen.getAllByRole('article');
    expect(cards.length).toBeGreaterThanOrEqual(MODEL_FINDINGS.length);
    expect(screen.getByRole('meter')).not.toHaveAttribute('aria-valuetext', 'Risk: none');
    expect(screen.getByText(/still undecided/)).toBeVisible();

    const inCard = (index: number, name: string) =>
      within(cards[index] as HTMLElement).getByRole('button', { name });
    await userEvent.click(inCard(0, 'Accept'));
    expect(screen.getByRole('status')).toHaveTextContent(/^Accepted\. Risk: \w+\. \d+ left\.$/);
    await userEvent.click(inCard(1, 'Keep anyway'));
    await userEvent.click(inCard(2, 'Edit'));
    await userEvent.type(screen.getByRole('textbox', { name: /Your replacement/ }), ' x');
    await click('Save');
    for (let i = 0; i < cards.length && screen.queryByText(/still undecided/); i++) {
      await userEvent.keyboard('n');
    }
    await waitFor(() => expect(screen.queryByText(/still undecided/)).toBeNull());

    await userEvent.click(screen.getByRole('checkbox', { name: SECOND_LOOK_CONFIRM_LABEL }));
    await click('Continue');
    await heading('Only this text will leave your device');
  });

  it('lists protected mentions as display-only chips', async () => {
    const { services } = scannerServices();
    await reachReview(services);
    const details = screen
      .getByText('Kept as written (looks like other people, not you)')
      .closest('details') as HTMLElement;
    expect(within(details).getByText('Gary Pemberton')).toBeInTheDocument();
  });

  it('Back to edit keeps the text and the next check scans again', async () => {
    const { services, scan } = scannerServices();
    await reachReview(services);
    expect(scan).toHaveBeenCalledTimes(1);
    await click('Back to edit');
    await heading('Write your report');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(SAMPLE_REPORT);
    await click('Check my report');
    await heading('Review your report');
    expect(scan).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/\d+ details? still undecided/)).toBeVisible();
  });
});
