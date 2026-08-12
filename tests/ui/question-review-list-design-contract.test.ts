import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  'src/features/quiz/components/result/QuestionReviewList.tsx',
  'utf8',
);

describe('question review list design contract', () => {
  it('uses semantic borders for neutral review and action states', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border-line');
    expect(source).toContain('border-control-border');
  });
});
