import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/features/adaptive/components/ProcessingSections.tsx', 'utf8');

describe('adaptive processing sections design contract', () => {
  it('uses semantic border tokens instead of raw neutral border utilities', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border-line');
    expect(source).toContain('border-line/50');
  });

  it('uses the control border token for the recovery action', () => {
    expect(source).toContain('border-control-border');
  });
});
