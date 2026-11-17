// Developer tool: prints, per report and run, every finding of an evaluation result with
// its quote and label, then missed gold, per-category recall and ACCUSED violations.
// Usage: npm run eval:inspect -- <resultFile> [--report rXX] [--run N] [--view raw|filtered]
// Stdout only; reads the (synthetic) dataset the result names and the result file; writes
// nothing. A v2 test result prints held-out text: owner and manager only.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addRecall,
  formatFinding,
  labelFinding,
  missedGold,
  recallTable,
  resolveGold,
  resolveMustNot,
  verifyTiming,
} from './evalInspectHelpers.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const USAGE =
  'Usage: npm run eval:inspect -- <resultFile> [--report rXX] [--run N] [--view raw|filtered]';

function fail(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(1);
}

/** A 1-based run number; anything else (missing, "abc", "1.5", "0") is a usage error. */
function parseRun(value) {
  const run = Number(value);
  if (value === undefined || !Number.isInteger(run) || run < 1) {
    fail('--run needs a positive integer.');
  }
  return run;
}

function parseArgs(argv) {
  const args = { file: null, report: null, run: null, view: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--report') args.report = argv[++i] ?? null;
    else if (arg === '--run') args.run = parseRun(argv[++i]);
    else if (arg === '--view') args.view = argv[++i] ?? null;
    else if (args.file === null) args.file = arg;
  }
  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Runs of the chosen view; old result files have no views and use the top-level runs. */
function runsOf(result, view) {
  if (view === null) return result.runs;
  const selected = result.views?.[view];
  if (selected === undefined) fail(`This result file has no "${view}" view.`);
  return selected.runs;
}

function inspectReport(report, run, reportRun, tally, violations) {
  const gold = resolveGold(report);
  const mustNot = resolveMustNot(report);
  const failed = reportRun.ok ? '' : ` (scan failed: ${reportRun.errorKind})`;
  console.log(`\n== ${report.id}, run ${run.run}${failed}`);
  if (!reportRun.ok) return;
  for (const finding of reportRun.findings) {
    const label = labelFinding(finding, gold, mustNot);
    console.log(formatFinding(report.text, finding, label));
    if (label.includes('ACCUSED')) {
      const key = `${report.id} run ${run.run}`;
      violations.set(key, (violations.get(key) ?? 0) + 1);
    }
  }
  const missed = missedGold(reportRun.findings, gold);
  for (const item of missed) console.log(`  [MISSED] ${item.label} "${item.quote}"`);
  addRecall(tally, gold, missed);
}

/**
 * The dataset a result was measured on: the held-out v2 test split for its result files
 * (`datasetVersion` reports.v2-test, file names with `-v2test-`), reports.v1 otherwise.
 * Prints dataset text: for the owner and the manager only, never for detector implementers.
 */
function datasetFileFor(result) {
  return result.datasetVersion === 'reports.v2-test'
    ? 'eval/datasets/reports.v2.test.json'
    : 'eval/datasets/reports.v1.json';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.file === null) fail('A result file is required.');
  const result = await readJson(resolve(process.cwd(), args.file));
  const datasetFile = datasetFileFor(result);
  const dataset = await readJson(resolve(root, datasetFile));
  if (dataset.version !== result.datasetVersion && result.datasetVersion !== undefined) {
    fail(`The result was measured on ${result.datasetVersion}, not ${dataset.version}.`);
  }
  const byId = new Map(dataset.reports.map((r) => [r.id, r]));
  const name = result.variant?.id ?? `${result.promptVersion}/${result.strategy}`;
  console.log(`variant: ${name}, dataset: ${datasetFile}, split: ${result.split}`);
  // `stalls` exists since stuck recovery (§G.2); older result files simply lack it.
  if (result.stalls !== undefined) {
    console.log(`stalls: ${result.stalls.recovered} recovered, ${result.stalls.terminal} terminal`);
  }
  const tally = {};
  const violations = new Map();
  const counts = [];
  for (const run of runsOf(result, args.view)) {
    if (args.run !== null && run.run !== args.run) continue;
    for (const reportRun of run.reports) {
      const report = byId.get(reportRun.reportId);
      if (report === undefined || (args.report !== null && report.id !== args.report)) continue;
      inspectReport(report, run, reportRun, tally, violations);
      if (reportRun.counts !== undefined) counts.push(reportRun.counts);
    }
  }
  const timing = verifyTiming(counts);
  if (timing !== null) {
    console.log(
      `\n== Verifier pass time: mean ${timing.mean} ms, max ${timing.max} ms (${timing.reports} scans)`,
    );
  }
  console.log('\n== Soft recall by category (span overlap, any category)');
  for (const line of recallTable(tally)) console.log(line);
  console.log('\n== ACCUSED violations');
  if (violations.size === 0) console.log('none');
  for (const [key, count] of violations) console.log(`  ${key}: ${count} finding(s)`);
}

await main();
