import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/features/adaptive/components/MasteryMatrix.tsx', 'utf8');

describe('adaptive mastery matrix design contract', () => {
  it('uses semantic border tokens instead of raw neutral border utilities', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border-line');
    expect(source).toContain('border-line/50');
  });

  it('uses the unstyled shared button primitive for sort controls', () => {
    expect(source).not.toMatch(/<button\b/);
    expect(source).toContain("import { ButtonBase } from '@/components/ui/ButtonBase';");
    expect(source.match(/<ButtonBase/g)).toHaveLength(2);
  });
});
