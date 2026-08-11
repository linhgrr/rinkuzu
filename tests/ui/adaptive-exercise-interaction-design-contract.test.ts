import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  'src/features/adaptive/components/exercise-question-interaction.tsx',
  'utf8',
);

describe('adaptive exercise interaction design contract', () => {
  it('keeps custom option controls on the styling-neutral button primitive', () => {
    expect(source).toContain("import { ButtonBase } from '@/components/ui/ButtonBase';");
    expect(source).not.toMatch(/<button\b/);
  });

  it('uses semantic border tokens for surfaces and controls', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border-line');
    expect(source).toContain('border-control-border');
    expect(source).toContain('hover:border-line-blue');
  });
});
