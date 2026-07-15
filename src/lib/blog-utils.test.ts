import { describe, expect, it } from 'vitest';
import { extractHeadingsFromMarkdown } from './blog-utils';

describe('extractHeadingsFromMarkdown', () => {
  it('extracts level-two and level-three headings with stable slugs', () => {
    expect(
      extractHeadingsFromMarkdown('# Title\n\n## First Section\nText\n### Child_section'),
    ).toEqual([
      { id: 'first-section', text: 'First Section' },
      { id: 'child-section', text: 'Child_section' },
    ]);
  });

  it('ignores empty or unsupported headings', () => {
    expect(extractHeadingsFromMarkdown('# Top\n## \n#### Too deep')).toEqual([]);
  });
});
