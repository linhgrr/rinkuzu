import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/features/quiz/components/create/CreateQuizHubPage.tsx', 'utf8');

describe('create quiz hub design contract', () => {
  it('uses semantic line borders for loading, draft, and empty-state surfaces', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source.match(/border-line/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
