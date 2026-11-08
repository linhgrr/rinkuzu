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

  it('transliterates Vietnamese heading ids', () => {
    expect(
      extractHeadingsFromMarkdown(
        "## Cách ghi nhớ những gì bạn học\n### Đánh giá: Bloom's Taxonomy",
      ),
    ).toEqual([
      { id: 'cach-ghi-nho-nhung-gi-ban-hoc', text: 'Cách ghi nhớ những gì bạn học' },
      { id: 'danh-gia-blooms-taxonomy', text: "Đánh giá: Bloom's Taxonomy" },
    ]);
  });

  it('ignores empty or unsupported headings', () => {
    expect(extractHeadingsFromMarkdown('# Top\n## \n#### Too deep')).toEqual([]);
  });
});

describe('extractHeadingsFromMarkdown ids', () => {
  it('gives repeated headings unique ids', () => {
    expect(extractHeadingsFromMarkdown('## Ví dụ\n### Example\n## Ví dụ').map((h) => h.id)).toEqual(
      ['vi-du', 'example', 'vi-du-2'],
    );
  });

  it('ignores heading-like lines inside fenced code blocks', () => {
    expect(
      extractHeadingsFromMarkdown(
        '## Real\n```md\n## Not a heading\n```\n~~~\n### Nope\n~~~\n### After',
      ),
    ).toEqual([
      { id: 'real', text: 'Real' },
      { id: 'after', text: 'After' },
    ]);
  });
});
