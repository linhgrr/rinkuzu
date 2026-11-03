/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';
import { getLoadedMathMarkdown, preloadMathRenderer } from './preloadMathRenderer';

const mathModule = vi.hoisted(() => ({ imported: false }));
vi.mock('./MathMarkdown', async (importOriginal) => {
  mathModule.imported = true;
  return importOriginal();
});

// The module-level loaded state persists across tests, so they run in order.
describe('MarkdownRenderer while KaTeX loads (RIN-732)', () => {
  it('settles at once for plain content without importing KaTeX', async () => {
    await preloadMathRenderer(['Plain question', 'It costs \\$5']);

    expect(mathModule.imported).toBe(false);
    expect(getLoadedMathMarkdown()).toBeNull();
  });

  it('lays out the pending math fallback hidden, so raw LaTeX never shows', async () => {
    const { container } = render(<MarkdownRenderer content={'Solve $x^2 = 4$'} />);

    // The first KaTeX import is a cold transform here, so the fallback stays up.
    const pending = await waitFor(() => {
      const element = container.querySelector('[data-math-pending]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(pending).toHaveClass('invisible');
    expect(pending).toHaveTextContent('Solve $x^2 = 4$');
  });

  it('renders math on the first commit once the preload has settled', async () => {
    await preloadMathRenderer(['Plain question', 'Option $x^2$']);
    expect(getLoadedMathMarkdown()).not.toBeNull();

    // No waitFor: the very first commit must already hold KaTeX output.
    const { container } = render(<MarkdownRenderer content={'Solve **now**: $x^2 = 4$'} />);

    expect(container.querySelector('[data-math-pending]')).toBeNull();
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.querySelector('strong')).toHaveTextContent('now');
  });
});
