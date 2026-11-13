// Developer tool: prints, per report and run, every finding of an evaluation result with
// its quote and label, then missed gold, per-category recall and ACCUSED violations.
// Usage: npm run eval:inspect -- <resultFile> [--report rXX] [--run N] [--view raw|filtered]
// Stdout only; reads the (synthetic) dataset and the result file; writes nothing.
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
} from './evalInspectHelpers.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const USAGE =
  'Usage: npm run eval:inspect -- <resultFile> [--report rXX] [--run N] [--view raw|filtered]';

function parseArgs(argv) {
  const args = { file: null, report: null, run: null, view: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--report') args.report = argv[++i] ?? null;
    else if (arg === '--run') args.run = Number(argv[++i]);
    else if (arg === '--view') args.view = argv[++i] ?? null;
    else if (args.file === null) args.file = arg;
  }
  return args;
}

function fail(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(1);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.file === null) fail('A result file is required.');
  const dataset = await readJson(resolve(root, 'eval/datasets/reports.v1.json'));
  const result = await readJson(resolve(process.cwd(), args.file));
  const byId = new Map(dataset.reports.map((r) => [r.id, r]));
  const name = result.variant?.id ?? `${result.promptVersion}/${result.strategy}`;
  console.log(`variant: ${name}, split: ${result.split}`);
  const tally = {};
  const violations = new Map();
  for (const run of runsOf(result, args.view)) {
    if (args.run !== null && run.run !== args.run) continue;
    for (const reportRun of run.reports) {
      const report = byId.get(reportRun.reportId);
      if (report === undefined || (args.report !== null && report.id !== args.report)) continue;
      inspectReport(report, run, reportRun, tally, violations);
    }
  }
  console.log('\n== Recall by category (scanned reports only)');
  for (const line of recallTable(tally)) console.log(line);
  console.log('\n== ACCUSED violations');
  if (violations.size === 0) console.log('none');
  for (const [key, count] of violations) console.log(`  ${key}: ${count} finding(s)`);
}

await main();
