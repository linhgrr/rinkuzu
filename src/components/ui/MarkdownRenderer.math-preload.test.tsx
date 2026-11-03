/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, waitFor } from '@testing-library/react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';
import { getLoadedMathMarkdown, preloadMathRenderer } from './preloadMathRenderer';

const mathModule = vi.hoisted(() => ({ imported: false }));
// Vitest resolves `next/dynamic` to the Pages Router loader, which renders null
// while loading. Next aliases it to the App Router one (React.lazy, so the
// Suspense fallback shows), which is what users get.
vi.mock('next/dynamic', () => import('next/dist/api/app-dynamic'));
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
    // Fresh modules: the earlier test already resolved next/dynamic's own lazy.
    vi.resetModules();
    const fresh = await import('./preloadMathRenderer');
    const { MarkdownRenderer: FreshMarkdownRenderer } = await import('./MarkdownRenderer');
    await fresh.preloadMathRenderer(['Plain question', 'Option $x^2$']);
    expect(fresh.getLoadedMathMarkdown()).not.toBeNull();

    // One synchronous commit outside act(), as React does in the browser: act()
    // would wait for the lazy chunk and hide a fallback flash.
    const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean | undefined };
    const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<FreshMarkdownRenderer content={'Solve **now**: $x^2 = 4$'} />));

      expect(container.querySelector('[data-math-pending]')).toBeNull();
      expect(container.querySelector('.katex')).not.toBeNull();
      expect(container.querySelector('strong')).toHaveTextContent('now');
    } finally {
      flushSync(() => root.unmount());
      reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });
});
