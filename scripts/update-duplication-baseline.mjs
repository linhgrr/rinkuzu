import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { fingerprintDuplicate, isImportOnlyDuplicate } from './check-duplication.mjs';

export function buildRatchetedBaseline(baseline, { fingerprints, totals }) {
  const unique = new Set(fingerprints);
  if (unique.size !== fingerprints.length) {
    throw new Error('Clone fingerprints are ambiguous; refusing to write a baseline.');
  }
  if (
    totals.clones > baseline.limits.clones ||
    totals.duplicatedLines > baseline.limits.duplicatedLines
  ) {
    throw new Error(
      `This tool only ratchets down: clones ${totals.clones}/${baseline.limits.clones}, ` +
        `duplicatedLines ${totals.duplicatedLines}/${baseline.limits.duplicatedLines}.`,
    );
  }
  return {
    ...baseline,
    limits: { ...baseline.limits, clones: totals.clones, duplicatedLines: totals.duplicatedLines },
    knownCloneFingerprints: [...fingerprints].sort(),
  };
}

function main() {
  const root = process.cwd();
  const baselinePath = path.join(root, 'quality', 'duplication-baseline.json');
  const reportPath = path.join(root, 'reports', 'jscpd', 'jscpd-report.json');
  if (!existsSync(reportPath)) {
    console.error(
      'No jscpd report found. Run `npm run check:duplication` immediately before this tool; it writes the report even when the gate fails.',
    );
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const fingerprinted = report.duplicates.filter((d) => !isImportOnlyDuplicate(root, d));
  const fingerprints = fingerprinted.map((d) => fingerprintDuplicate(root, d));
  const totals = report.statistics.total;

  const label = (f) => `src/${f.name.replaceAll('\\', '/')}:${f.start}-${f.end}`;
  for (const d of fingerprinted) console.log(`- ${label(d.firstFile)} <-> ${label(d.secondFile)}`);
  console.log(
    `clones=${totals.clones} duplicatedLines=${totals.duplicatedLines} fingerprints=${fingerprints.length}`,
  );

  const next = buildRatchetedBaseline(baseline, { fingerprints, totals });
  if (!process.argv.includes('--apply')) {
    console.log('Dry run — review the clone list above, then re-run with --apply.');
    return;
  }
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log('Baseline ratcheted.');
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) main();
