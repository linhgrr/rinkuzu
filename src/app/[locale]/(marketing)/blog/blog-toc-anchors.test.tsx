import { render, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BlogPostPage from './[slug]/page';

// RIN-640: every TOC entry must point at a rendered heading, otherwise the
// click and the scroll-spy highlight both do nothing.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/blog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/components/blog/ReadingProgressBar', () => ({ ReadingProgressBar: () => null }));
vi.mock('@/components/blog/ShareButtons', () => ({ ShareButtons: () => null }));

const posts = [
  { slug: 'ai-powered-quiz-generation-guide' },
  { slug: 'knowledge-graphs-adaptive-learning-pdfs' },
];

const observed: Element[] = [];

beforeEach(() => {
  observed.length = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe(el: Element) {
        observed.push(el);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('blog table of contents anchors', () => {
  it.each(posts)('$slug: every TOC entry targets a rendered heading', async ({ slug }) => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{}}>
        {await BlogPostPage({ params: Promise.resolve({ locale: 'en', slug }) })}
      </NextIntlClientProvider>,
    );

    const toc = container.querySelector('nav[aria-labelledby="toc-heading"]');
    expect(toc).not.toBeNull();
    const entries = within(toc as HTMLElement).getAllByRole('button');
    const headings = Array.from(
      container.querySelectorAll('[data-rich-text="document"] :is(h2, h3)'),
    );

    expect(entries.length).toBeGreaterThan(5);
    expect(headings.map((h) => h.textContent)).toEqual(entries.map((e) => e.textContent));
    expect(new Set(headings.map((h) => h.id)).size).toBe(headings.length);
    expect(observed).toEqual(headings);
  });
});
