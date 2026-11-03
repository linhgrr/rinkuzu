/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';
import { preloadMathRenderer } from './preloadMathRenderer';

// Records whether the KaTeX module was ever imported. The factory runs only on the
// first import of './MathMarkdown', so the tests below run in order on purpose.
const mathModule = vi.hoisted(() => ({ imported: false }));
vi.mock('./MathMarkdown', async (importOriginal) => {
  mathModule.imported = true;
  return importOriginal();
});

// KaTeX loads on demand (RIN-679); its first import is a cold transform in vitest.
const KATEX_LOAD = { timeout: 10_000 };

describe('MarkdownRenderer KaTeX loading (RIN-679)', () => {
  it('renders plain markdown without importing the KaTeX pipeline', async () => {
    const { container } = render(
      <MarkdownRenderer
        content={'Which **organelle** makes ATP? It costs \\$5 or $10.'}
        variant="prompt"
      />,
    );

    expect(screen.getByText('organelle')).toHaveProperty('tagName', 'STRONG');
    expect(container).toHaveTextContent('It costs $5 or $10.');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('.katex')).toBeNull();
    expect(mathModule.imported).toBe(false);
  });

  it('does not preload KaTeX for plain contents', async () => {
    preloadMathRenderer(['Plain question', 'It costs \\$5', '']);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mathModule.imported).toBe(false);
  });

  it('preloads KaTeX when one of the contents has math', async () => {
    preloadMathRenderer(['Plain question', 'Option $x^2$']);
    await waitFor(() => expect(mathModule.imported).toBe(true), KATEX_LOAD);
  });

  it('loads KaTeX for inline and block math and keeps the markdown around it', async () => {
    const { container } = render(
      <MarkdownRenderer content={'Solve **now**: $x^2 = 4$\n\n$$\n\\frac{1}{2}\n$$'} />,
    );

    await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(2), KATEX_LOAD);
    expect(screen.getByText('now')).toHaveProperty('tagName', 'STRONG');
    expect(container.querySelector('.katex-display')).not.toBeNull();
    expect(mathModule.imported).toBe(true);
  });
});
