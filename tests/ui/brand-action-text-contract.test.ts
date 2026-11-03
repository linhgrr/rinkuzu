import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// RIN-797 (spec RIN-795): labels on the filled orange action colour read from
// --brand-action-text. Light keeps white; dark uses a dark ink because white on
// the lighter dark-theme orange (#fb923c and up) is below 3:1.

const ROOT = process.cwd();
const css = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

function block(selectorStart: string): Map<string, string> {
  const start = css.indexOf(selectorStart);
  if (start === -1) throw new Error(`block not found: ${selectorStart}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('\n  }', open);
  const tokens = new Map<string, string>();
  for (const [, name, value] of css.slice(open + 1, close).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    if (name && value) tokens.set(name, value.trim());
  }
  return tokens;
}

const light = block('  :root {');
const dark = block("  [data-theme='dark'],\n  .dark {");

/** Resolves a token the way the cascade does for an element under `.dark`. */
function resolve(name: string, theme: 'light' | 'dark'): string {
  const value = (theme === 'dark' ? dark.get(name) : undefined) ?? light.get(name);
  if (value === undefined) throw new Error(`missing token ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  return ref ? resolve(ref, theme) : value;
}

type Rgb = [number, number, number];

function hex(value: string): Rgb {
  const digits = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (!digits) throw new Error(`not a 6-digit hex colour: ${value}`);
  const n = Number.parseInt(digits, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(hex(fg)), luminance(hex(bg))].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

describe('brand action label token', () => {
  it('keeps white labels on orange in light', () => {
    expect(resolve('--brand-action-text', 'light')).toBe('#ffffff');
  });

  it.each(['--brand-action', '--brand-action-hover', '--brand-action-active'])(
    'dark label on %s clears 4.5:1 for text',
    (background) => {
      const ratio = contrast(resolve('--brand-action-text', 'dark'), resolve(background, 'dark'));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('dark FloatingSupportButton icon on --accent clears 3:1', () => {
    const ratio = contrast(resolve('--brand-action-text', 'dark'), resolve('--accent', 'dark'));
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('is exposed as the text-brand-action-text utility', () => {
    const config = fs.readFileSync(path.join(ROOT, 'tailwind.config.js'), 'utf8');
    expect(config).toMatch(/'action-text':\s*'var\(--brand-action-text\)'/);
  });
});

// Marketing/landing visuals are protected; these keep text-white (RIN-797 PR).
const PROTECTED = new Set([
  'src/app/[locale]/(marketing)/pricing/page.tsx',
  'src/app/[locale]/(marketing)/contact/page.tsx',
  'src/features/adaptive/components/sections/HeroSection.tsx',
]);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [full] : [];
  });
}

describe('labels on --brand-action use the token', () => {
  const fill = /(^|[\s:!'"`])bg-brand-action(?![\w-])/;
  const white = /(^|[\s:!'"`])text-white(?![\w/-])/;

  it('no app-shell line pairs bg-brand-action with text-white', () => {
    const offenders = sourceFiles(path.join(ROOT, 'src'))
      .map((file) => path.relative(ROOT, file).split(path.sep).join('/'))
      .filter((file) => !PROTECTED.has(file))
      .flatMap((file) =>
        fs
          .readFileSync(path.join(ROOT, file), 'utf8')
          .split('\n')
          .flatMap((line, i) => (fill.test(line) && white.test(line) ? [`${file}:${i + 1}`] : [])),
      );
    expect(offenders).toEqual([]);
  });

  it('FloatingSupportButton icon reads the token', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/features/communications/components/FloatingSupportButton.tsx'),
      'utf8',
    );
    expect(source).toContain('bg-accent text-brand-action-text');
    expect(source).not.toMatch(white);
  });
});
