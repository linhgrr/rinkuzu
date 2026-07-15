import path from 'node:path';

import { scanDatabaseDdlBoundary } from './database/ddl-boundary.mjs';

const repoRoot = path.resolve(process.cwd());

try {
  const violations = await scanDatabaseDdlBoundary({ repoRoot });
  console.log(
    JSON.stringify(
      {
        status: violations.length === 0 ? 'clean' : 'violation',
        allowedDdlWriter: 'scripts/sync-performance-indexes.mjs',
        violationCount: violations.length,
        violations,
      },
      null,
      2,
    ),
  );
  if (violations.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
