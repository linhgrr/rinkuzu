import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/features/profile/components/ProfileControlCenter.tsx', 'utf8');

describe('profile control center design contract', () => {
  it('uses semantic borders for the profile hero and quick-access header', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border-line');
    expect(source).toContain('border-line/50');
  });
});
