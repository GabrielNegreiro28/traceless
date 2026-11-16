import { defineConfig } from 'vitest/config';

/**
 * Firestore security rules tests (tests/rules). They need the Firestore emulator, so they run
 * only through `npm run test:rules` (firebase emulators:exec), never in `npm test`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
