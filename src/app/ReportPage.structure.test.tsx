import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import type { ReportStructurer } from '../application/ports/ReportStructurer';
import { SECOND_LOOK_CONFIRM_LABEL } from '../features/review/SecondLook';
import { FakeAuthService } from '../infrastructure/fakes/FakeAuthService';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { FakeReportRepository } from '../infrastructure/fakes/FakeReportRepository';
import { FakeReportStructurer } from '../infrastructure/fakes/FakeReportStructurer';
import { createAppError } from '../shared/appError';
import { createServices } from './compositionRoot';
import { createAppRoutes } from './router';
import { FAKE_TEST_ENV } from './services/renderWithServices';
import { ServicesProvider } from './services/ServicesProvider';

function openReport(reportStructurer: ReportStructurer) {
  const repository = new FakeReportRepository();
  const services = createServices(FAKE_TEST_ENV, {
    fakeScanner: new FakeIdentityScanner(),
    caseBackend: { auth: new FakeAuthService(), repository },
    reportStructurer,
  });
  const router = createMemoryRouter(createAppRoutes([]), { initialEntries: ['/report'] });
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>,
  );
  return repository;
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

async function approveTypedReport(): Promise<void> {
  await heading('Write your report');
  await userEvent.type(
    screen.getByRole('textbox'),
    'A manager approved false invoices from a shell company.',
  );
  await click('Check my report');
  await heading('Review your report');
  await userEvent.click(screen.getByRole('checkbox', { name: SECOND_LOOK_CONFIRM_LABEL }));
  await click('Continue');
  await heading('Only this text will leave your device');
  const acknowledgement = screen.queryByRole('checkbox');
  if (acknowledgement !== null) await userEvent.click(acknowledgement);
  await click('Approve this text');
  await heading('Approved. This is what the organization will receive.');
}

describe('/report structured card on fake services', () => {
  it('organizes the approved text once and sends the category the reporter chose', async () => {
    const structurer = new FakeReportStructurer();
    const repository = openReport(structurer);
    await approveTypedReport();

    const category = await screen.findByRole('combobox', { name: 'Category' });
    expect(category).toHaveValue('fraud');
    expect(structurer.texts).toHaveLength(1);
    await userEvent.selectOptions(category, 'retaliation');

    await click('Send to organization');
    await heading('Report sent. Save your case key.');
    expect(repository.submitted[0]?.category).toBe('retaliation');
  });

  it('a failed structuring never blocks sending; nothing extra is sent', async () => {
    const error = createAppError('Offline', { message: 'offline' });
    const repository = openReport(new FakeReportStructurer({ error }));
    await approveTypedReport();

    await screen.findByText('Couldn’t organize the report — you can still send it.');
    await click('Send to organization');
    await heading('Report sent. Save your case key.');
    expect(repository.submitted).toHaveLength(1);
    expect(repository.submitted[0]).not.toHaveProperty('category');
  });
});
