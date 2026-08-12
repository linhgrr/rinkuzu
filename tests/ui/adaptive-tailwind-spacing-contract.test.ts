import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ADAPTIVE_COMPONENTS = path.join(process.cwd(), 'src/features/adaptive/components');
const UNSUPPORTED_SPACING_UTILITY = /\b(?:h|min-h|max-h|w|min-w|max-w)-(?:30|50|55|70|75|100)\b/g;

function readAdaptiveTsxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readAdaptiveTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [entryPath] : [];
  });
}

describe('adaptive Tailwind spacing contract', () => {
  it('does not use spacing utilities absent from the configured Tailwind scale', () => {
    const violations = readAdaptiveTsxFiles(ADAPTIVE_COMPONENTS).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return [...source.matchAll(UNSUPPORTED_SPACING_UTILITY)].map(
        (match) => `${path.relative(process.cwd(), filePath)}: ${match[0].trim()}`,
      );
    });

    expect(violations).toEqual([]);
  });
});
