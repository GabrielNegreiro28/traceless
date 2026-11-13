// Canary: proves the developer evaluation page and its dataset never reach a production bundle.
//
// Builds the app in production mode into a fresh directory under the OS temp folder
// (nothing in the repo is touched) and fails if any output file contains the eval page
// sentinel or distinctive text from the evaluation dataset.
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

// Present only in src/features/eval/EvalPage.tsx and in eval/datasets/reports.v1.json (report r01).
const FORBIDDEN = [
  'traceless-eval-page-v1',
  'Detection evaluation (developer tool)',
  'sterile processing tech',
  '__eval/results',
];

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

async function findLeaks(outDir) {
  const files = await listFiles(outDir);
  const leaks = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const needle of FORBIDDEN) {
      if (content.includes(needle)) leaks.push(`${relative(outDir, file)} (${needle})`);
    }
  }
  return { files, leaks };
}

// The temp dir is intentionally NOT removed afterwards (project rule: never delete files).
const outDir = await mkdtemp(join(tmpdir(), 'traceless-eval-canary-'));
await build({
  root,
  mode: 'production',
  logLevel: 'warn',
  build: { outDir, emptyOutDir: false },
});
const { files, leaks } = await findLeaks(outDir);

if (files.length === 0) {
  process.stderr.write('verify-no-eval-in-dist: the build produced no files.\n');
  process.exit(1);
}
if (leaks.length > 0) {
  process.stderr.write(`verify-no-eval-in-dist: eval code or data found in: ${leaks.join(', ')}\n`);
  process.exit(1);
}
process.stdout.write(`verify-no-eval-in-dist: OK (${files.length} files scanned, no eval page).\n`);
