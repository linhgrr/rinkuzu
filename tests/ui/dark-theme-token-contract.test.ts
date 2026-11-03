import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Dark theme as a token-level contract (RIN-791). Components use the semantic
 * layer (`text-ink`, `bg-surface-warm`, ...), so the dark block must flip that
 * layer, and the legacy `--bg-*` / `--text-*` / `--border-*` roles must resolve
 * through it instead of carrying their own hex values that can drift.
 */

const css = fs.readFileSync('src/app/globals.css', 'utf8');

function darkBlock(): Map<string, string> {
  const start = css.indexOf("[data-theme='dark'],\n  .dark {");
  expect(start, 'dark theme block').toBeGreaterThan(-1);
  const body = css
    .slice(css.indexOf('{', start) + 1, css.indexOf('\n  }', start))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = new Map<string, string>();
  for (const [, name = '', value = ''] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

type Rgba = [number, number, number, number];

function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = Number.parseInt(hex[1] ?? '', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])];
  throw new Error(`not a literal colour: ${value}`);
}

function over([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba {
  const mix = (top: number, base: number) => top * a + base * (1 - a);
  return [mix(r, br), mix(g, bg), mix(b, bb), 1];
}

function token(tokens: Map<string, string>, name: string): Rgba {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`missing dark token ${name}`);
  return parseColor(value);
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: Rgba, bg: Rgba): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const SEMANTIC_TOKENS = [
  '--surface',
  '--surface-page',
  '--surface-warm',
  '--surface-blue',
  '--hero',
  '--ink',
  '--ink-strong',
  '--ink-muted',
  '--accent',
  '--accent-hover',
  '--accent-soft',
  '--accent-warm',
  '--accent-pale',
  '--accent-text',
  '--line',
  '--line-blue',
  '--divider-warm',
  '--progress-track',
  '--progress-blue-track',
  '--progress-blue',
  '--badge-cool',
  '--control-surface',
  '--control-border',
  '--card-shadow-accent',
  '--info',
  '--info-surface',
  '--success',
  '--success-surface',
  '--purple',
  '--purple-surface',
] as const;

describe('dark theme token contract', () => {
  const dark = darkBlock();

  it('flips every semantic token with a literal dark value', () => {
    for (const token of SEMANTIC_TOKENS) {
      const value = dark.get(token);
      expect(value, token).toBeDefined();
      expect(value, token).not.toMatch(/var\(/);
    }
  });

  it('resolves the legacy bg/text/border roles through the semantic layer', () => {
    // Re-declared (not just deleted) so a `.dark` subtree below <html> resolves
    // them against its own semantic values instead of inheriting light ones.
    expect(dark.get('--bg-page')).toBe('var(--surface-page)');
    expect(dark.get('--bg-section')).toBe('var(--surface-warm)');
    expect(dark.get('--bg-surface')).toBe('var(--surface)');
    expect(dark.get('--bg-surface-muted')).toBe('var(--surface-warm)');
    expect(dark.get('--bg-surface-warm')).toBe('var(--surface-warm)');
    expect(dark.get('--text-primary')).toBe('var(--ink)');
    expect(dark.get('--text-secondary')).toBe('var(--ink-muted)');
    expect(dark.get('--text-inverse')).toBe('var(--accent-text)');
    expect(dark.get('--border-subtle')).toBe('var(--line)');
    expect(dark.get('--border-default')).toBe('var(--line)');
    expect(dark.get('--border-strong')).toBe('var(--line-blue)');
    // Hints stay intentionally dimmer than --ink-muted.
    expect(dark.get('--text-muted')).toBe('#94948d');
  });

  it('keeps --brand-action-strong theme-stable and gives dark actions a dark label', () => {
    expect(dark.get('--brand-action-strong')).toBe('#e67020');
    // RIN-797: white is ~2.3:1 on the dark #fb923c, so the dark label is ink.
    expect(dark.get('--brand-action-text')).toBe('#1c1917');
  });

  // [foreground, background] — translucent backgrounds sit on --surface.
  const TEXT_PAIRS: Array<[string, string]> = [
    ['--ink', '--surface'],
    ['--ink', '--surface-warm'],
    ['--ink', '--surface-page'],
    ['--ink-muted', '--surface'],
    ['--ink-muted', '--surface-warm'],
    ['--info', '--info-surface'],
    ['--accent', '--surface'],
    ['--success', '--success-surface'],
    ['--purple', '--purple-surface'],
    ['--accent-text', '--accent'],
    ['--text-muted', '--surface'],
  ];

  it.each(TEXT_PAIRS)('%s on %s clears 4.5:1 for text', (fg, bg) => {
    const background = over(token(dark, bg), token(dark, '--surface'));
    const ratio = contrast(over(token(dark, fg), background), background);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
