import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createServices, type Services } from '../compositionRoot';
import type { AppEnv } from '../env';
import { ServicesProvider } from './ServicesProvider';

/** Env for tests: fake AI mode never touches Firebase or Chrome. */
export const FAKE_TEST_ENV: AppEnv = {
  firebase: {
    apiKey: 'test-api-key',
    authDomain: 'demo-traceless.firebaseapp.com',
    projectId: 'demo-traceless',
    storageBucket: 'demo-traceless.appspot.com',
    messagingSenderId: '0',
    appId: '1:0:web:0',
  },
  recaptchaSiteKey: 'test-site-key',
  aiMode: 'fake',
  useEmulators: true,
};

/** Deterministic fake services from the composition root, with optional per-test overrides. */
export function createFakeServices(overrides: Partial<Services> = {}): Services {
  return { ...createServices(FAKE_TEST_ENV), ...overrides };
}

/** Test helper: renders `ui` inside a ServicesProvider that carries the fake services. */
export function renderWithServices(
  ui: ReactElement,
  overrides: Partial<Services> = {},
): RenderResult & { readonly services: Services } {
  const services = createFakeServices(overrides);
  const result = render(<ServicesProvider services={services}>{ui}</ServicesProvider>);
  return Object.assign(result, { services });
}
