/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { QuestionContent, QuestionExcerpt } from './QuestionContent';

// KaTeX loads on demand (RIN-679); its first import is a cold transform in vitest.
const KATEX_LOAD = { timeout: 10_000 };

describe('QuestionContent', () => {
  it('renders GFM and KaTeX through the shared educational-content contract', async () => {
    const { container } = render(
      <QuestionContent content={'Choose **two** values where $x^2 = 4$.\n\n- $2$\n- $-2$'} />,
    );
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull(), KATEX_LOAD);

    expect(screen.getByText('two')).toHaveProperty('tagName', 'STRONG');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(container.querySelector('[data-rich-text="prompt"]')).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('ignores raw HTML and rejects unsafe link protocols', () => {
    const { container } = render(
      <QuestionContent
        content={
          '<script>alert("xss")</script>\n\n<b>unsafe html</b>\n\n[bad](javascript:alert(1))'
        }
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('a')).toBeInTheDocument();
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toContain('javascript:');
  });

  it('renders option content as a block without nested paragraph ownership assumptions', async () => {
    const { container } = render(
      <QuestionContent content={'# **A** and [$B$](https://example.com)'} variant="option" />,
    );
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull(), KATEX_LOAD);

    expect(container.querySelector('[data-rich-text="option"]')).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('A');
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  it('uses a native heading and keeps heading markdown phrasing-only', async () => {
    const { container } = render(
      <QuestionContent
        content={'Choose **two** values:\n\n- $2$\n- $-2$'}
        variant="compact"
        headingLevel={3}
      />,
    );
    await waitFor(() => expect(container.querySelector('h3 .katex')).not.toBeNull(), KATEX_LOAD);

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent(/Choose two values/);
    expect(heading.querySelector('strong')).toHaveTextContent('two');
    expect(heading.querySelector('p, ul, ol, li, div')).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe('QuestionExcerpt', () => {
  it('uses the Unified markdown AST instead of slicing source syntax', () => {
    render(
      <QuestionExcerpt
        content={'## **Newton’s law**\n\nFind $F = ma$ from [the diagram](https://example.com).'}
        maxLines={2}
      />,
    );

    const excerpt = screen.getByText(/Newton’s law/);
    expect(excerpt).toHaveTextContent('Newton’s law Find F = ma from the diagram.');
    expect(excerpt).not.toHaveTextContent('##');
    expect(excerpt).not.toHaveTextContent('**');
    expect(excerpt).toHaveClass('line-clamp-2');
  });
});
