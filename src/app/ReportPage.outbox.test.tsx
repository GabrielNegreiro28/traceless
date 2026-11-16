import { SECOND_LOOK_CONFIRM_LABEL } from '../features/review/SecondLook';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import type { ModelFinding } from '../domain/detection/types';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { createServices } from './compositionRoot';
import { createAppRoutes } from './router';
import { FAKE_TEST_ENV } from './services/renderWithServices';
import { ServicesProvider } from './services/ServicesProvider';

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

/** The composition root's fake services (with its ledger decorators) over a scripted scanner. */
function openReport() {
  const fakeScanner = new FakeIdentityScanner({ respond: () => ({ findings: MODEL_FINDINGS }) });
  const services = createServices(FAKE_TEST_ENV, { fakeScanner });
  const router = createMemoryRouter(createAppRoutes([]), { initialEntries: ['/report'] });
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>,
  );
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

async function acceptEveryCard(): Promise<void> {
  for (let guard = 0; guard < 20; guard++) {
    const accept = screen.queryAllByRole('button', { name: 'Accept' })[0];
    if (accept === undefined) return;
    await userEvent.click(accept);
  }
  throw new Error('cards never resolved');
}

function ledgerLines(): string[] {
  const list = screen.getByRole('list', { name: 'Steps so far' });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

describe('/report outbox and approval on fake services', () => {
  it('goes sample, scan, decide all, outbox, approve, and shows exactly the preview', async () => {
    openReport();
    await heading('Write your report');
    await click('Try a sample report');
    await click('Check my report');
    await heading('Review your report');
    await acceptEveryCard();
    await waitFor(() => expect(screen.queryByText(/still undecided/)).toBeNull());

    await userEvent.click(screen.getByRole('checkbox', { name: SECOND_LOOK_CONFIRM_LABEL }));
    await click('Continue');
    await heading('Only this text will leave your device');
    const preview = screen.getByRole('figure', { name: 'Your text after your changes' });
    const previewText = preview.querySelector('p')?.textContent ?? '';
    expect(previewText).not.toContain('Brackenford');
    const acknowledgement = screen.queryByRole('checkbox');
    if (acknowledgement !== null) await userEvent.click(acknowledgement);

    await click('Approve this text');
    const approvedHeading = await heading('Approved. This is what the organization will receive.');
    await waitFor(() => expect(approvedHeading).toHaveFocus());
    const approved = screen.getByRole('figure', { name: 'Approved text' });
    expect(approved.querySelector('p')?.textContent).toBe(previewText);
    expect(screen.getByRole('button', { name: 'Send to organization' })).toBeEnabled();
    await screen.findByText('Organized by the demo organizer (no AI)');

    await userEvent.click(screen.getByText('What happened to your text'));
    expect(ledgerLines()).toEqual([
      'Identity scan · on your device (demo scanner) · your original text, never left this device',
      'Approval · on your device · created the text you approved',
      'Organized for the organization · on your device (demo organizer) · only the text you approved',
    ]);

    await click('Back');
    await heading('Only this text will leave your device');
    await click('Back to review');
    await heading('Review your report');
  });
});
