import { createRequire } from 'node:module';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import type { Config } from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

// RIN-1524: every semantic colour is a bare CSS variable, and Tailwind 3
// emitted no CSS for an opacity modifier on one (`bg-surface/95` rendered
// transparent). This compiles representative classes through the project's
// own config and checks each one emits a rule.
const require = createRequire(import.meta.url);
const projectConfig = require('../../tailwind.config.js') as Config;

const MODIFIED_CLASSES = [
  'bg-surface/95',
  'hover:bg-accent-soft/60',
  'bg-ink/20',
  'border-line-blue/30',
  'bg-primary/90',
  'text-ink/55',
  'fill-accent/40',
  'stroke-line/50',
  'via-surface/50',
  'ring-accent/25',
  'shadow-ink/10',
  'bg-orange-500/10',
  'text-neutral-700/80',
  'bg-brand-action/[.33]',
];

const PLAIN_CLASSES = [
  'bg-surface/0',
  'bg-surface',
  'text-ink',
  'border-line-blue',
  'bg-primary',
  'from-surface',
];

let css = '';

function escapeClass(className: string): string {
  return className.replace(/[/:[\].]/g, (character) => `\\${character}`);
}

function ruleBody(className: string): string {
  const selector = `.${escapeClass(className)}`;
  const start =
    css.indexOf(`${selector} {`) === -1
      ? css.indexOf(`${selector}:`)
      : css.indexOf(`${selector} {`);
  if (start === -1) return '';
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

beforeAll(async () => {
  const classes = [...MODIFIED_CLASSES, ...PLAIN_CLASSES].join(' ');
  const result = await postcss([
    tailwindcss({
      ...projectConfig,
      content: [{ raw: `<div class="${classes}"></div>`, extension: 'html' }],
      corePlugins: { preflight: false },
    }),
  ]).process('@tailwind utilities;', { from: undefined });
  css = result.css;
});

describe('Tailwind opacity modifiers on var() colours (RIN-1524)', () => {
  it.each(MODIFIED_CLASSES)('%s emits a translucent colour rule', (className) => {
    const body = ruleBody(className);
    expect(body).toMatch(/color-mix\(in srgb, var\(--[\w-]+\) [\d.]+%, transparent\)/);
  });

  it('turns the modifier into the matching mix percentage', () => {
    expect(ruleBody('bg-surface/95')).toContain(
      'background-color: color-mix(in srgb, var(--bg-surface) 95%, transparent)',
    );
    expect(ruleBody('text-ink/55')).toContain(
      'color: color-mix(in srgb, var(--ink) 55%, transparent)',
    );
    expect(ruleBody('bg-brand-action/[.33]')).toContain('var(--brand-action) 33%');
  });

  it('keeps plain classes on the bare variable, without color-mix', () => {
    expect(ruleBody('bg-surface')).toContain('background-color: var(--bg-surface)');
    expect(ruleBody('text-ink')).toContain('color: var(--ink)');
    expect(ruleBody('border-line-blue')).toContain('border-color: var(--line-blue)');
    expect(ruleBody('bg-primary')).toContain('background-color: var(--primary)');
    expect(ruleBody('from-surface')).toContain('--tw-gradient-from: var(--surface)');
    expect(ruleBody('from-surface')).toContain('--tw-gradient-to: rgb(255 255 255 / 0)');
    expect(ruleBody('bg-surface/0')).toContain('background-color: rgb(255 255 255 / 0)');
    for (const className of PLAIN_CLASSES) {
      expect(ruleBody(className)).not.toContain('color-mix');
    }
  });

  it('leaves hex palette colours untouched', () => {
    const extend = projectConfig.theme?.extend as { colors: { green: Record<string, string> } };
    expect(extend.colors.green['500']).toBe('#22a06b');
  });
});
