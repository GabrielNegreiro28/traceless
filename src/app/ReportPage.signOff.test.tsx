import { SECOND_LOOK_CONFIRM_LABEL } from '../features/review/SecondLook';
import { render, screen, waitFor } from '@testing-library/react';
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

/**
 * Regression (owner bug, 17/11): the investigator flagged the sample's sign-off and suggested
 * a vaguer self-description that still names the shift. Accepting every card then put a NEW
 * sign-off in the final text and approval failed with no card left to decide.
 */
const MODEL_FINDINGS: readonly ModelFinding[] = [
  {
    quote: 'the tired trainer on the night shift',
    category: 'ROLE_UNIQUE',
    reason: 'Your sign-off describes your role and shift.',
    suggestion: 'a night-shift worker',
  },
  {
    quote: 'only night-shift forklift trainer',
    category: 'ROLE_UNIQUE',
    reason: 'Very few people hold this exact role.',
    suggestion: 'a forklift trainer',
  },
];

function openReport(): void {
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
  for (let guard = 0; guard < 30; guard++) {
    const accept = screen.queryAllByRole('button', { name: 'Accept' })[0];
    if (accept === undefined) return;
    await userEvent.click(accept);
  }
  throw new Error('cards never resolved');
}

describe('/report sign-off suggestion regression', () => {
  it('accepting every card, including the sign-off suggestion, approves the sample', async () => {
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
    const acknowledgement = screen.queryByRole('checkbox');
    if (acknowledgement !== null) await userEvent.click(acknowledgement);
    await click('Approve this text');

    await heading('Approved. This is what the organization will receive.');
    expect(screen.queryByText(/This text was not approved/)).toBeNull();
    const approved = screen.getByRole('figure', { name: 'Approved text' });
    const approvedText = approved.querySelector('p')?.textContent ?? '';
    expect(approvedText).not.toContain('night shift');
    expect(approvedText).not.toContain('night-shift worker');
  });
});
