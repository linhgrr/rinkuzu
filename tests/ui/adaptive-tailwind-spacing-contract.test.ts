import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ADAPTIVE_COMPONENTS = path.join(process.cwd(), 'src/features/adaptive/components');
const NUMERIC_SPACING_UTILITY = /\b(?:h|min-h|max-h|w|min-w|max-w)-(\d+(?:\.\d+)?)\b/g;
const require = createRequire(import.meta.url);
const resolveConfig = require('tailwindcss/resolveConfig') as (config: unknown) => {
  theme: { spacing?: Record<string, string> };
};
const tailwindConfig = require('../../tailwind.config.js') as unknown;
const configuredSpacing = new Set(Object.keys(resolveConfig(tailwindConfig).theme.spacing ?? {}));

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
      return [...source.matchAll(NUMERIC_SPACING_UTILITY)]
        .filter((match) => !configuredSpacing.has(match[1] ?? ''))
        .map((match) => `${path.relative(process.cwd(), filePath)}: ${match[0].trim()}`);
    });

    expect(violations).toEqual([]);
  });
});
