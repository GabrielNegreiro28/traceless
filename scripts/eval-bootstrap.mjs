// Developer tool: per-report bootstrap 95% CI for the pooled strict recall (failed scans count
// as missed) and the ACCUSED violation rate of an evaluation result file.
// Usage: npm run eval:bootstrap -- <resultFile> [<resultFile> ...]
// Reads only the per-report counts stored in the result file (no dataset text); deterministic
// (fixed seed, 10,000 resamples); writes nothing.
import { readFile } from 'node:fs/promises';
import { bootstrapIntervals, tallyByReport } from './evalBootstrapHelpers.ts';

const RESAMPLES = 10_000;
const SEED = 20261117;

const fmt = (x) => (x === null ? 'n/a' : x.toFixed(3));
const show = (i) => `${fmt(i.point)} [${fmt(i.low)}, ${fmt(i.high)}]`;

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run eval:bootstrap -- <resultFile> [<resultFile> ...]');
  process.exit(1);
}
for (const file of files) {
  const result = JSON.parse(await readFile(file, 'utf8'));
  const tallies = tallyByReport(result);
  const { strictRecall, accusedViolation } = bootstrapIntervals(tallies, RESAMPLES, SEED);
  console.log(file);
  console.log(`  reports: ${tallies.length}, runs: ${result.runs.length}`);
  console.log(`  strict recall (failed = missed): ${show(strictRecall)}`);
  console.log(`  ACCUSED violation rate:          ${show(accusedViolation)}`);
}
