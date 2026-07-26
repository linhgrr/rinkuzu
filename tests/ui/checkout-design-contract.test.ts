import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function channelToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) =>
    channelToLinear(Number.parseInt(normalized.slice(offset, offset + 2), 16)),
  );
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(left: string, right: string): number {
  const leftLuminance = luminance(left);
  const rightLuminance = luminance(right);
  return (
    (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05)
  );
}

function cssHex(source: string, token: string): string {
  const match = source.match(new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`Missing CSS color token: ${token}`);
  return match[1];
}

describe('checkout design contract', () => {
  it('keeps the primary action text above WCAG AA contrast', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');
    const action = cssHex(css, 'primary');
    const actionText = cssHex(css, 'primary-8');

    expect(css).toContain('--brand-action-text: var(--primary-8);');
    expect(css).toMatch(/\.btn-primary[\s\S]*?color:\s*var\(--brand-action-text\)/u);
    expect(contrast(action, actionText)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses a solid focus token for buttons instead of the translucent token', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');
    expect(css).toMatch(
      /\.btn:focus-visible\s*\{[\s\S]*?outline:\s*3px solid var\(--focus-ring\)/u,
    );
  });
});
