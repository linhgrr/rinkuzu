import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/features/quiz/components/PDFViewer.tsx', 'utf8');

describe('PDF viewer design contract', () => {
  it('uses the semantic line border for the document frame', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border border-line');
  });
});
