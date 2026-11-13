// Fails when the production build would ship with fake AI or emulators enabled.
// Loads the env the same way `vite build` does (mode "production") and prints only
// the NAMES of offending variables, never their values.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const env = loadEnv('production', root, 'VITE_');

const failed = [];
if (env.VITE_AI_MODE === 'fake') failed.push('VITE_AI_MODE');
if (env.VITE_USE_EMULATORS === 'true') failed.push('VITE_USE_EMULATORS');

if (failed.length > 0) {
  process.stderr.write(
    `verify-prod-config: not allowed in a production build: ${failed.join(', ')}\n`,
  );
  process.exit(1);
}
process.stdout.write('verify-prod-config: OK\n');
