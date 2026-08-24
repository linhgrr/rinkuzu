import path from 'node:path';

import { scanDatabaseDdlBoundary } from './database/ddl-boundary.mjs';

const repoRoot = path.resolve(process.cwd());

try {
  const violations = await scanDatabaseDdlBoundary({ repoRoot });
  console.log(
    JSON.stringify(
      {
        status: violations.length === 0 ? 'clean' : 'violation',
        allowedDdlWriters: [
          'scripts/sync-performance-indexes.mjs',
          'scripts/migrate-first-purchase-eligibility.mjs',
          'scripts/migrate-premium-quiz-catalog.mjs',
        ],
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
