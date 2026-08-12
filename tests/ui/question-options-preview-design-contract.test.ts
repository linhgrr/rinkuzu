import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  'src/features/quiz/components/shared/QuestionOptionsPreview.tsx',
  'utf8',
);

describe('question options preview design contract', () => {
  it('uses the semantic control border for non-correct option markers', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain("'border-control-border'");
    expect(source).toContain("'border-green-500 bg-green-500'");
  });
});
