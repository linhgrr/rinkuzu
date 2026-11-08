import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Tailwind 3.4 only generates outline widths from theme.outlineWidth (0/1/2/4/8).
// A class like `focus-visible:outline-3` compiles to nothing, so keyboard focus falls
// back to the 1px `outline` default instead of the 3px focus-ring token (RIN-1149).
const SRC = path.join(process.cwd(), 'src');
const NUMERIC_OUTLINE_WIDTH = /(?<![\w-])outline-(\d+)(?![\w.[/-])/g;
const require = createRequire(import.meta.url);
const resolveConfig = require('tailwindcss/resolveConfig') as (config: unknown) => {
  theme: { outlineWidth?: Record<string, string> };
};
const tailwindConfig = require('../../tailwind.config.js') as unknown;
const configuredOutlineWidths = new Set(
  Object.keys(resolveConfig(tailwindConfig).theme.outlineWidth ?? {}),
);

function readSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readSourceFiles(entryPath);
    return entry.isFile() && /\.(?:tsx|ts)$/u.test(entry.name) && !/\.test\./u.test(entry.name)
      ? [entryPath]
      : [];
  });
}

describe('Tailwind outline width contract', () => {
  it('knows the configured outline widths', () => {
    expect(configuredOutlineWidths.has('2')).toBe(true);
    expect(configuredOutlineWidths.has('3')).toBe(false);
  });

  it('does not use outline width utilities absent from the configured Tailwind scale', () => {
    const violations = readSourceFiles(SRC).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return [...source.matchAll(NUMERIC_OUTLINE_WIDTH)]
        .filter((match) => !configuredOutlineWidths.has(match[1] ?? ''))
        .map((match) => `${path.relative(process.cwd(), filePath)}: ${match[0]}`);
    });

    expect(violations).toEqual([]);
  });
});
