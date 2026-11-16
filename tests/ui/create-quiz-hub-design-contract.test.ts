import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// The draft row lives in its own file (RIN-1733), so the contract reads both surfaces.
const source = [
  'src/features/quiz/components/create/CreateQuizHubPage.tsx',
  'src/features/quiz/components/create/DraftRow.tsx',
]
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

describe('create quiz hub design contract', () => {
  it('uses semantic line borders for loading, draft, and empty-state surfaces', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source.match(/border-line/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
