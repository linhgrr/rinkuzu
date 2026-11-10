import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';
import type { BlogPost } from '@/lib/blog/content';
import { blogMessages } from '../../../../../tests/helpers/blog-intl-mock';
import BlogIndexPage from './page';
import BlogPostPage from './[slug]/page';

// RIN-1258: the "try this quiz" card. A post places it with a `<TryQuiz />` line or
// gets one after the body from its `quiz` block; the /blog index always shows one.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/blog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next-intl/server', () => import('../../../../../tests/helpers/blog-intl-mock'));
vi.mock('@/components/blog/ReadingProgressBar', () => ({ ReadingProgressBar: () => null }));
vi.mock('@/components/ui/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

const override = vi.hoisted(() => ({
  value: {} as Partial<BlogPost>,
}));

vi.mock('@/lib/blog/posts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/blog/posts')>();
  return {
    ...actual,
    getBlogArticle: (locale: Parameters<typeof actual.getBlogArticle>[0], slug: string) => {
      const article = actual.getBlogArticle(locale, slug);
      if (!article) return article;
      const withoutQuiz: BlogPost = { ...article };
      delete withoutQuiz.quiz;
      return { ...withoutQuiz, ...override.value };
    },
  };
});

const SLUG = 'ai-powered-quiz-generation-guide';
const en = blogMessages.en.tryQuiz;

const renderPost = async (post: Partial<BlogPost>) => {
  override.value = post;
  const page = await BlogPostPage({ params: Promise.resolve({ locale: 'en', slug: SLUG }) });
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      {page}
    </NextIntlClientProvider>,
  );
};

const cards = () => screen.queryAllByTestId('try-quiz-card');
const at = (list: HTMLElement[], index: number): HTMLElement => {
  const element = list[index];
  if (!element) throw new Error(`no element at ${index}`);
  return element;
};
const isBefore = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  override.value = {};
  vi.unstubAllGlobals();
});

describe('blog post quiz card', () => {
  it('shows no card without a quiz block or marker', async () => {
    await renderPost({ content: '# Intro\n\nBody' });

    expect(cards()).toHaveLength(0);
  });

  it('adds one end card after the body and before the share buttons', async () => {
    await renderPost({
      content: '# Intro\n\nBody',
      quiz: { slug: 'fake-quiz', teaser: 'How much stuck?' },
    });

    expect(cards()).toHaveLength(1);
    const card = at(cards(), 0);
    expect(card).toHaveAttribute('data-position', 'blog_end');
    expect(isBefore(screen.getByTestId('markdown'), card)).toBe(true);
    expect(isBefore(card, screen.getByText('Share this post:'))).toBe(true);
    expect(screen.getByRole('heading', { name: en.heading })).toBeInTheDocument();
    expect(screen.getByText('How much stuck?')).toBeInTheDocument();
    expect(screen.getByText(en.meta)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.button })).toHaveAttribute(
      'href',
      `/en/try?entry=blog&post=${SLUG}&quiz=fake-quiz`,
    );
  });

  it('renders an inline card where the marker is, with no duplicate end card', async () => {
    await renderPost({
      content: '# Intro\n\nFirst\n\n<TryQuiz teaser="Inline teaser" />\n\n## More\n\nSecond',
      quiz: { teaser: 'Frontmatter teaser' },
    });

    const markdown = screen.getAllByTestId('markdown');
    expect(cards()).toHaveLength(1);
    const card = at(cards(), 0);
    expect(card).toHaveAttribute('data-position', 'blog_inline');
    expect(isBefore(at(markdown, 0), card)).toBe(true);
    expect(isBefore(card, at(markdown, 1))).toBe(true);
    expect(screen.getByText('Inline teaser')).toBeInTheDocument();
    expect(screen.queryByText('Frontmatter teaser')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.button })).toHaveAttribute(
      'href',
      `/en/try?entry=blog&post=${SLUG}`,
    );
  });

  it('renders a marker card without a quiz block', async () => {
    await renderPost({ content: 'Body\n\n<TryQuiz />\n' });

    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveAttribute('data-position', 'blog_inline');
  });
});

describe.each(locales)('blog index quiz card on /%s', (locale) => {
  it('shows the card once, above the posts, without a post', async () => {
    const page = await BlogIndexPage({ params: Promise.resolve({ locale }) });
    render(
      <NextIntlClientProvider locale={locale} messages={{}}>
        {page}
      </NextIntlClientProvider>,
    );

    const copy = blogMessages[locale].tryQuiz;
    expect(cards()).toHaveLength(1);
    const card = at(cards(), 0);
    expect(card).toHaveAttribute('data-position', 'blog_index');
    expect(screen.getByRole('heading', { name: copy.heading })).toBeInTheDocument();
    expect(screen.getByText(copy.meta)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.button })).toHaveAttribute(
      'href',
      `/${locale}/try?entry=blog`,
    );
    expect(isBefore(card, at(screen.getAllByRole('heading', { level: 2 }), 1))).toBe(true);
  });
});
