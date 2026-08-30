import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  'src/features/subscription/components/SubscriptionPageClient.tsx',
  'utf8',
);

describe('subscription page design contract', () => {
  it('uses the semantic line border for the free plan surface', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border-line');
  });
});
