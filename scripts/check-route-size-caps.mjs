import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { evaluateRouteBudgets, readJsonStrict } from './check-perf-budget.mjs';

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Absolute route bundle caps only: no base rebuild, no Lighthouse. Cheap enough
 * for a pull request; the regression-vs-base check stays on master (RIN-1429).
 */
export const checkRouteSizeCaps = (rootDir = defaultRootDir) => {
  const rawConfig = readJsonStrict(path.join(rootDir, '.size-limit.json'), 'Size config');
  const { entries, violations } = evaluateRouteBudgets({ rootDir, rawConfig });
  return {
    entries,
    violations: violations.filter((violation) => violation.code === 'bundle-absolute-cap'),
  };
};

const main = () => {
  const rootDirArg = process.argv[2];
  const rootDir = rootDirArg ? path.resolve(rootDirArg) : defaultRootDir;
  if (!fs.existsSync(rootDir)) throw new Error(`Root does not exist: ${rootDir}`);
  const { entries, violations } = checkRouteSizeCaps(rootDir);
  console.log(`Checked ${entries.length} routes against their absolute caps.`);
  for (const v of violations) {
    console.error(
      `OVER CAP ${v.route} [${v.group}]: ${v.actual} B gzip > ${v.limit} B (+${v.actual - v.limit} B)`,
    );
  }
  if (violations.length > 0) process.exit(1);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
