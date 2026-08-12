import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/features/quiz/components/QuizMetaForm.tsx', 'utf8');

describe('quiz meta form design contract', () => {
  it('uses the semantic control border for the privacy checkbox', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border-control-border rounded focus:ring-brand-trust');
  });
});
