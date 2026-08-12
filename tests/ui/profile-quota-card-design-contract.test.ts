import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/features/profile/components/ProfileQuotaCard.tsx', 'utf8');

describe('profile quota card design contract', () => {
  it('uses semantic subtle borders for quota surfaces', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source.match(/border-line\/50/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
