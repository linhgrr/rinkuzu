import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/features/quiz/components/player/DesktopQuizLayout.tsx', 'utf8');
const sharedQuestionCardSource = fs.readFileSync(
  'src/features/quiz/components/player/QuizQuestionCard.tsx',
  'utf8',
);

describe('desktop quiz design contract', () => {
  it('uses the styling-neutral button primitive for custom question navigation', () => {
    expect(source).toContain("import { ButtonBase } from '@/components/ui/ButtonBase';");
    expect(source).not.toMatch(/<button\b/);
  });

  it('uses semantic border tokens instead of raw neutral border utilities', () => {
    const playerSource = `${source}\n${sharedQuestionCardSource}`;
    expect(playerSource).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(sharedQuestionCardSource).toContain('border-line hover:border-line-blue');
    expect(sharedQuestionCardSource).toContain('border-control-border');
  });
});
