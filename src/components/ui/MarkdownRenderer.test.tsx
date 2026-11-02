/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { extractHeadingsFromMarkdown } from '@/lib/blog-utils';
import { MarkdownRenderer } from './MarkdownRenderer';

const BLOG_SAMPLE = [
  '# Post title',
  '',
  '## Cách ghi nhớ những gì bạn học',
  'Đoạn văn.',
  '',
  "### Đánh giá: Bloom's Taxonomy",
  '',
  '## From PDF to Knowledge Graph: The **Content** Processor',
  '',
  '```md',
  '## Not a heading',
  '```',
  '',
  '### 1. Remember (Recall)',
  '',
  '## Ví dụ',
  '',
  '## Ví dụ',
  '',
  '#### Too deep for the TOC',
].join('\n');

function renderedHeadingIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('h2, h3')).map((el) => el.id);
}

describe('MarkdownRenderer headingIds', () => {
  it('gives h2/h3 the same ids the blog TOC extracts', () => {
    const { container } = render(<MarkdownRenderer content={BLOG_SAMPLE} headingIds />);

    const tocIds = extractHeadingsFromMarkdown(BLOG_SAMPLE).map((h) => h.id);
    expect(tocIds).toEqual([
      'cach-ghi-nho-nhung-gi-ban-hoc',
      'danh-gia-blooms-taxonomy',
      'from-pdf-to-knowledge-graph-the-content-processor',
      '1-remember-recall',
      'vi-du',
      'vi-du-2',
    ]);
    expect(renderedHeadingIds(container)).toEqual(tocIds);
    for (const id of tocIds) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('leaves h1 and h4+ without ids', () => {
    const { container } = render(<MarkdownRenderer content={BLOG_SAMPLE} headingIds />);

    expect(container.querySelector('h1')).not.toHaveAttribute('id');
    expect(container.querySelector('h4')).not.toHaveAttribute('id');
  });

  it('adds no heading ids unless asked (quiz and question markdown)', () => {
    const { container } = render(<MarkdownRenderer content={BLOG_SAMPLE} />);

    expect(container.querySelectorAll('h2, h3')).toHaveLength(6);
    expect(container.querySelectorAll('[id]')).toHaveLength(0);
  });
});
