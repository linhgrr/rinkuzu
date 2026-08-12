import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  'src/features/subscription/components/UpgradePaywallModal.tsx',
  'utf8',
);

describe('upgrade paywall modal design contract', () => {
  it('uses semantic borders for paywall surfaces, dividers, and controls', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border-line');
    expect(source).toContain('border-line/50');
    expect(source).toContain('border-control-border');
  });
});
