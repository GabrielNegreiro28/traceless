import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;
const BASE_URL = `http://localhost:${PORT}`;
const isCi = Boolean(process.env.CI);

/** Opt in locally to the installed Chrome (`E2E_CHANNEL=chrome`); default is Playwright's Chromium. */
const channel = process.env.E2E_CHANNEL;
const browser = channel === undefined || channel === '' ? {} : { channel };

/**
 * E2E runs the real app in fake-AI mode: the demo scanner, the demo organizer and the
 * in-memory case backend. No Firebase project, no model download, no network.
 * The VITE_FIREBASE_* values are dummy, non-secret placeholders the env schema requires.
 */
const FAKE_MODE_ENV = {
  VITE_AI_MODE: 'fake',
  VITE_USE_EMULATORS: 'false',
  VITE_FIREBASE_API_KEY: 'e2e-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-traceless.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-traceless',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-traceless.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
  VITE_FIREBASE_APP_ID: '1:0:web:0',
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: 'e2e-site-key',
  VITE_APPCHECK_DEBUG_TOKEN: '',
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : [['list']],
  outputDir: 'test-results',
  use: { baseURL: BASE_URL, trace: 'on-first-retry', ...browser },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCi,
    env: FAKE_MODE_ENV,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
