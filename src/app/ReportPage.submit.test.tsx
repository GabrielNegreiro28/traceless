import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReportRepository } from '../application/ports/ReportRepository';
import { parseCaseKey } from '../domain/case/caseKey';
import { FakeAuthService } from '../infrastructure/fakes/FakeAuthService';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { FakeReportRepository } from '../infrastructure/fakes/FakeReportRepository';
import { createAppError } from '../shared/appError';
import type { Result } from '../shared/result';
import { SECOND_LOOK_CONFIRM_LABEL } from '../features/review/SecondLook';
import { createServices } from './compositionRoot';
import { createAppRoutes } from './router';
import { FAKE_TEST_ENV } from './services/renderWithServices';
import { ServicesProvider } from './services/ServicesProvider';

function openReport(wrap: (inner: FakeReportRepository) => ReportRepository = (r) => r) {
  const repository = new FakeReportRepository();
  const auth = new FakeAuthService();
  const services = createServices(FAKE_TEST_ENV, {
    fakeScanner: new FakeIdentityScanner(),
    caseBackend: { auth, repository: wrap(repository) },
  });
  const router = createMemoryRouter(createAppRoutes([]), { initialEntries: ['/report'] });
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>,
  );
  return { repository, auth };
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

async function resolveEveryCard(): Promise<void> {
  for (let guard = 0; guard < 30; guard++) {
    const accept = screen.queryAllByRole('button', { name: 'Accept' })[0];
    const keep = screen.queryAllByRole('button', { name: 'Keep anyway' })[0];
    const next = accept ?? keep;
    if (next === undefined) return;
    await userEvent.click(next);
  }
  throw new Error('cards never resolved');
}

/** Sample → review → outbox → approve; returns the approved text shown. */
async function approveSample(): Promise<string> {
  await heading('Write your report');
  await click('Try a sample report');
  await click('Check my report');
  await heading('Review your report');
  await resolveEveryCard();
  await userEvent.click(screen.getByRole('checkbox', { name: SECOND_LOOK_CONFIRM_LABEL }));
  await click('Continue');
  await heading('Only this text will leave your device');
  const acknowledgement = screen.queryByRole('checkbox');
  if (acknowledgement !== null) await userEvent.click(acknowledgement);
  await click('Approve this text');
  await heading('Approved. This is what the organization will receive.');
  const approved = screen.getByRole('figure', { name: 'Approved text' });
  return approved.querySelector('p')?.textContent ?? '';
}

function setOnline(online: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('/report sending on fake services', () => {
  it('sends exactly the approved text and shows the case key once', async () => {
    const { repository, auth } = openReport();
    const approvedText = await approveSample();
    expect(auth.signIns).toBe(0);

    await click('Send to organization');
    await heading('Report sent. Save your case key.');
    expect(auth.signIns).toBe(1);
    expect(repository.submitted).toHaveLength(1);
    expect(repository.submitted[0]?.text).toBe(approvedText);

    const shown = screen.getByTestId('case-key').textContent ?? '';
    expect(shown).toMatch(/^(\w{4} ){5}\w{2}$/);
    expect(parseCaseKey(shown)).toBe(repository.submitted[0]?.caseKey);

    await userEvent.click(screen.getByText('What happened to your text'));
    const lines = within(screen.getByRole('list', { name: 'Steps so far' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(lines.at(-1)).toBe(
      'Sent to the organization · demo mode, kept in this tab · only the text you approved',
    );

    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'I saved my key somewhere safe' }));
    await userEvent.click(done);
    await heading('Write your report');
    expect(screen.queryByTestId('case-key')).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('offline: keeps the report in the tab, sends nothing, and retries when back online', async () => {
    const { repository, auth } = openReport();
    await approveSample();
    setOnline(false);

    await click('Send to organization');
    await heading("You're offline");
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your report stays in this tab. Reconnect to send.',
    );
    expect(auth.signIns).toBe(0);
    expect(repository.submitted).toEqual([]);

    setOnline(true);
    await click('Try sending again');
    await heading('Report sent. Save your case key.');
    expect(repository.submitted).toHaveLength(1);
  });

  it('a refused send returns to the approved text, ready to send again', async () => {
    const { repository } = openReport();
    await approveSample();
    repository.failWith({ kind: 'PermissionDenied', message: 'rules' });

    await click('Send to organization');
    await heading("Your report wasn't sent");
    await click('Back to the approved text');
    await heading('Approved. This is what the organization will receive.');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send to organization' })).toBeEnabled(),
    );
  });

  it('an unconfirmed send says it may have arrived, and a retry reuses the same key', async () => {
    let first = true;
    const { repository } = openReport((inner) => ({
      getCase: (key) => inner.getCase(key),
      submit: async (report) => {
        const saved = await inner.submit(report);
        if (!first) return saved;
        first = false; // the write landed, but its answer was lost
        return { ok: false, error: createAppError('SubmitUnconfirmed', { message: 'late' }) };
      },
    }));
    await approveSample();

    await click('Send to organization');
    await heading("We couldn't confirm your report arrived");
    expect(screen.getByRole('alert')).toHaveTextContent(
      'It may have reached the organization. Your text stays in this tab.',
    );
    expect(screen.queryByText(/wasn't sent/)).toBeNull();

    await click('Try sending again');
    await heading('Report sent. Save your case key.');
    expect(repository.submitted).toHaveLength(1);
    const shown = screen.getByTestId('case-key').textContent ?? '';
    expect(parseCaseKey(shown)).toBe(repository.submitted[0]?.caseKey);
  });

  it('while sending: warns before the tab closes and refuses in-app navigation', async () => {
    let release: (value: Result<void, never>) => void = () => undefined;
    openReport((inner) => ({
      getCase: (key) => inner.getCase(key),
      submit: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    }));
    await approveSample();
    await click('Send to organization');
    await screen.findByRole('button', { name: /Sending/ });

    const closing = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(closing);
    expect(closing.defaultPrevented).toBe(true);

    await userEvent.click(screen.getByRole('link', { name: /Traceless/ }));
    expect(screen.getByRole('button', { name: /Sending/ })).toBeVisible();

    release({ ok: true, value: undefined });
    await heading('Report sent. Save your case key.');
  });
});
