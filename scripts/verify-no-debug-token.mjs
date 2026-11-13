// Canary: proves an App Check debug token can never reach a production bundle.
//
// Builds the app in production mode with a fake token in the environment, into a
// fresh directory under the OS temp folder (nothing in the repo is touched), and
// fails if the token string appears in any output file. `src/app/env.ts` (the only
// module that reads the token) is added as an extra entry with its exports kept,
// so the check is meaningful even before the module is wired into the UI.
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const CANARY = 'traceless-canary-7f3a';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

async function buildWithCanary(outDir) {
  process.env.VITE_APPCHECK_DEBUG_TOKEN = CANARY;
  await build({
    root,
    mode: 'production',
    logLevel: 'warn',
    build: {
      outDir,
      emptyOutDir: false,
      rolldownOptions: {
        input: { index: join(root, 'index.html'), env: join(root, 'src/app/env.ts') },
        preserveEntrySignatures: 'strict',
      },
    },
  });
}

async function findLeaks(outDir) {
  const files = await listFiles(outDir);
  const leaks = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    if (content.includes(CANARY)) leaks.push(relative(outDir, file));
  }
  return { files, leaks };
}

const outDir = await mkdtemp(join(tmpdir(), 'traceless-canary-'));
await buildWithCanary(outDir);
const { files, leaks } = await findLeaks(outDir);

if (files.length === 0) {
  process.stderr.write('verify-no-debug-token: the build produced no files.\n');
  process.exit(1);
}
if (leaks.length > 0) {
  process.stderr.write(`verify-no-debug-token: debug token found in: ${leaks.join(', ')}\n`);
  process.exit(1);
}
process.stdout.write(`verify-no-debug-token: OK (${files.length} files scanned, no token).\n`);
