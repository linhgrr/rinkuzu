import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const FIGMA_COLOR_TOKENS = [
  '--primary-0: #fffbf8;',
  '--primary-1: #fff2e9;',
  '--primary-2: #ffe5d4;',
  '--primary-3: #ffd6bb;',
  '--primary: #ff7c23;',
  '--primary-5: #ea660c;',
  '--primary-6: #d05908;',
  '--primary-7: #733810;',
  '--primary-8: #441f05;',
  '--cta: #fa621d;',
  '--neutral-white: #ffffff;',
  '--neutral-warm-2: #fffcf9;',
  '--neutral-warm-3: #fffaf5;',
  '--neutral-warm-31: #f6e2d5;',
  '--neutral-warm-4: #d9d5d0;',
  '--neutral-warm-5: #bab7b3;',
  '--neutral-warm-6: #595856;',
  '--neutral-warm-7: #403f3d;',
  '--neutral-warm-8: #2a0b00;',
  '--secondary-1: #f8fbff;',
  '--secondary-2: #e2ecfc;',
  '--secondary-3: #c2d6e4;',
  '--secondary-4: #718ebd;',
  '--alpha-00: rgba(217, 213, 208, 0.4);',
  '--alpha-1: rgba(68, 31, 5, 0.2);',
  '--alpha-2: rgba(68, 31, 5, 0.4);',
  '--alpha-3: rgba(68, 31, 5, 0.7);',
  '--alpha-04: rgba(217, 213, 208, 0.25);',
  '--linear-1: linear-gradient(90deg, #f25d1b 0%, #ff7c23 100%);',
  '--status-1: #eaeff3;',
  '--status-2: #076cee;',
  '--status-3: #eaf6e4;',
  '--status-4: #14c145;',
  '--status-5: #828282;',
] as const;

describe('Figma color token contract', () => {
  it('keeps the approved Figma variables as the light-mode source of truth', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');

    for (const token of FIGMA_COLOR_TOKENS) {
      expect(css).toContain(token);
    }
  });

  it('maps Figma fills to semantic app roles', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');

    expect(css).toContain('--surface-page: #f8f8f8;');
    expect(css).toContain('--surface: #fefefe;');
    expect(css).toContain('--surface-warm: var(--primary-0);');
    expect(css).toContain('--hero: var(--primary-2);');
    expect(css).toContain('--line: #e8eeff;');
    expect(css).toContain('--brand-action: var(--cta);');
    expect(css).toContain('--brand-action-text: var(--neutral-white);');
    expect(css).toContain('--ink-muted: var(--alpha-3);');
    expect(css).toContain('--control-surface: var(--alpha-04);');
    expect(css).toContain('--control-border: var(--alpha-00);');
    expect(css).toContain('--progress-gradient: var(--linear-1);');
    expect(css).toContain('--success: var(--status-4);');
    expect(css).toContain('--success-surface: var(--status-3);');
    expect(css).toContain('--info: var(--status-2);');
    expect(css).toContain('--info-surface: var(--status-1);');
    expect(css).toContain('--state-skipped: var(--status-5);');
  });
});
