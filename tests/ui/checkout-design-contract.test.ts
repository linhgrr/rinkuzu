import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('checkout design contract', () => {
  it('keeps the approved bright-orange action treatment with white text', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');

    expect(css).toContain('--cta: var(--primary);');
    expect(css).toContain('--brand-action: var(--cta);');
    expect(css).toContain('--brand-action-hover: var(--primary-5);');
    expect(css).toContain('--brand-action-active: var(--primary-7);');
    expect(css).toContain('--brand-action-text: var(--neutral-white);');
    expect(css).toMatch(/\.btn-primary[\s\S]*?color:\s*var\(--brand-action-text\)/u);
  });

  it('uses a solid focus token for buttons instead of the translucent token', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');
    expect(css).toMatch(
      /\.btn:focus-visible\s*\{[\s\S]*?outline:\s*3px solid var\(--focus-ring\)/u,
    );
  });
});
