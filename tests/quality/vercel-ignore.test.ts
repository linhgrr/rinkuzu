import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const vercelIgnore = ignore().add(readFileSync(path.join(repositoryRoot, '.vercelignore'), 'utf8'));

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
  });
}

describe('.vercelignore deployment boundary', () => {
  it('excludes root quality reports without excluding production report source', () => {
    expect(vercelIgnore.ignores('reports/mutation/mutation.json')).toBe(true);
    expect(vercelIgnore.ignores('src/app/[locale]/(app)/admin/reports/page.tsx')).toBe(false);
    expect(vercelIgnore.ignores('src/app/api/admin/reports/route.ts')).toBe(false);
    expect(vercelIgnore.ignores('src/features/admin/reports/api/admin-reports-api.ts')).toBe(false);
  });

  it('does not exclude any source file from the Vercel deployment', () => {
    const ignoredSourceFiles = listFiles(path.join(repositoryRoot, 'src'))
      .map((filePath) => path.relative(repositoryRoot, filePath).replaceAll(path.sep, '/'))
      .filter((filePath) => vercelIgnore.ignores(filePath));

    expect(ignoredSourceFiles).toEqual([]);
  });
});
