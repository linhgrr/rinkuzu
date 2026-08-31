import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  listFiles,
  listRepoPaths,
  repoRoot,
  toRepoPath,
} from '../../scripts/repo-files.shared.mjs';

describe('toRepoPath', () => {
  it('names a file the way the repository does, on any platform', () => {
    expect(toRepoPath(path.join(repoRoot, 'src', 'lib', 'formatters.ts'))).toBe(
      'src/lib/formatters.ts',
    );
  });

  it('accepts a path that is already relative', () => {
    expect(toRepoPath('src/lib/formatters.ts')).toBe('src/lib/formatters.ts');
  });
});

describe('listFiles', () => {
  it('finds sources under a directory', () => {
    expect(listRepoPaths('src/lib/*.ts')).toContain('src/lib/formatters.ts');
  });

  it('accepts several patterns at once', () => {
    const paths = listRepoPaths(['src/lib/*.ts', 'scripts/*.shared.mjs']);

    expect(paths).toContain('src/lib/formatters.ts');
    expect(paths).toContain('scripts/repo-files.shared.mjs');
  });

  it('never returns dependency or build output, however wide the pattern', () => {
    const paths = listRepoPaths('**/*.ts');

    expect(paths.some((file) => file.includes('node_modules/'))).toBe(false);
    expect(paths.some((file) => file.includes('.next/'))).toBe(false);
  });

  it('honours an extra exclusion on top of the standing ones', () => {
    const withTests = listRepoPaths('src/lib/*.ts');
    const withoutTests = listRepoPaths('src/lib/*.ts', { exclude: ['**/*.test.ts'] });

    expect(withTests.some((file) => file.endsWith('.test.ts'))).toBe(true);
    expect(withoutTests.some((file) => file.endsWith('.test.ts'))).toBe(false);
  });

  it('sorts by repository path, so guard output does not depend on the filesystem', () => {
    const paths = listRepoPaths('src/lib/**/*.ts');

    expect(paths).toEqual([...paths].sort((left, right) => left.localeCompare(right)));
  });

  it('returns absolute paths that can be read directly', () => {
    for (const filePath of listFiles('scripts/*.shared.mjs')) {
      expect(path.isAbsolute(filePath)).toBe(true);
    }
  });
});
