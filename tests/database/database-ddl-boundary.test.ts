import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  findDdlViolations,
  scanDatabaseDdlBoundary,
} from '../../scripts/database/ddl-boundary.mjs';

describe('database DDL boundary', () => {
  it('ignores comments, strings, and declarative schema indexes', () => {
    const source = `
      // collection.createIndex({ email: 1 })
      const example = "db.command({ collMod: 'users' })";
      UserSchema.index({ email: 1 }, { unique: true });
    `;

    expect(findDdlViolations(source, 'safe.ts')).toEqual([]);
  });

  it('detects direct, computed, destructured, and raw-command DDL', () => {
    const source = `
      collection.createIndex({ email: 1 });
      collection['dropIndex']('old_1');
      createIndexes();
      db.command({ collMod: 'users' });
    `;

    expect(findDdlViolations(source, 'unsafe.ts').map((finding) => finding.operation)).toEqual([
      'createIndex',
      'dropIndex',
      'createIndexes',
      'collMod',
    ]);
  });

  it('fails closed when a runtime source file is malformed', () => {
    expect(findDdlViolations('collection.createIndex({', 'broken.ts')).toContainEqual(
      expect.objectContaining({
        file: 'broken.ts',
        kind: 'parse_error',
      }),
    );
  });

  it('finds no second DDL writer in first-party runtime and scripts', async () => {
    const violations = await scanDatabaseDdlBoundary({ repoRoot: path.resolve(process.cwd()) });
    expect(violations).toEqual([]);
  }, 60_000);
});
