import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import BlogIndexPage from './page';
import BlogPostPage, { generateStaticParams as postParams } from './[slug]/page';
import AuthorPage, { generateStaticParams as authorParams } from './authors/[slug]/page';

// RIN-404: the blog index, post and author routes render from content/blog, and the two
// posts migrated from hand-written routes stay at their URLs with the same copy.

vi.mock('next-intl/server', () => import('../../../../../tests/helpers/next-intl-server'));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/blog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/components/blog/ReadingProgressBar', () => ({ ReadingProgressBar: () => null }));
vi.mock('@/components/blog/ShareButtons', () => ({ ShareButtons: () => null }));
vi.mock('@/components/blog/TableOfContents', () => ({ TableOfContents: () => null }));
vi.mock('@/components/ui/MarkdownRenderer', () => ({ MarkdownRenderer: () => null }));

// Pin the content source to the two migrated posts, so publishing a new post (a
// content-file-only PR, RIN-406) does not change the lists and neighbours asserted here.
vi.mock('@/lib/blog/content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/blog/content')>();
  const migrated = new Set([
    'ai-powered-quiz-generation-guide',
    'knowledge-graphs-adaptive-learning-pdfs',
  ]);
  const getAllBlogPosts = () => actual.getAllBlogPosts().filter((post) => migrated.has(post.slug));
  return {
    ...actual,
    getAllBlogPosts,
    getBlogPostsByLocale: (locale: string) =>
      getAllBlogPosts().filter((post) => post.locale === locale),
    getBlogPostBySlug: (locale: string, slug: string) =>
      getAllBlogPosts().find((post) => post.locale === locale && post.slug === slug),
  };
});

const AI_GUIDE = 'ai-powered-quiz-generation-guide';
const KNOWLEDGE_GRAPHS = 'knowledge-graphs-adaptive-learning-pdfs';

const renderIn = (locale: string, element: ReactElement | null) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {element}
    </NextIntlClientProvider>,
  );

describe('blog routes from content/blog', () => {
  it('pre-renders a post route for each migrated post and the author page', () => {
    expect(postParams()).toEqual(
      expect.arrayContaining([{ slug: AI_GUIDE }, { slug: KNOWLEDGE_GRAPHS }]),
    );
    expect(authorParams()).toEqual([{ slug: 'rinkuzu-team' }]);
  });

  it.each(['en', 'vi'])(
    'renders the AI guide article on /%s from its frontmatter',
    async (locale) => {
      renderIn(locale, await BlogPostPage({ params: Promise.resolve({ locale, slug: AI_GUIDE }) }));

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'How AI Transforms PDF Learning into Personalized Quizzes',
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('AI in Education')).toBeInTheDocument();
      expect(screen.getByText('March 27, 2026 · 9 min read')).toBeInTheDocument();
      expect(screen.getByText('AI & PDFs')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'RinKuzu Team' })).toHaveAttribute(
        'href',
        `/${locale}/blog/authors/rinkuzu-team`,
      );
      expect(
        screen.getByRole('link', { name: /Knowledge Graphs & Bloom's Taxonomy →/ }),
      ).toHaveAttribute('href', `/${locale}/blog/${KNOWLEDGE_GRAPHS}`);
      // The English body falls back on /vi; the page chrome follows the route (RIN-1391).
      expect(
        screen.getByText(locale === 'vi' ? 'Chưa có bài trước' : 'No previous post'),
      ).toBeInTheDocument();
    },
  );

  it('links the older post back to the newer one', async () => {
    renderIn(
      'en',
      await BlogPostPage({ params: Promise.resolve({ locale: 'en', slug: KNOWLEDGE_GRAPHS }) }),
    );

    expect(screen.getByText('March 20, 2026 · 10 min read')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /← How AI Transforms PDF Learning/ })).toHaveAttribute(
      'href',
      `/en/blog/${AI_GUIDE}`,
    );
    expect(screen.getByText('More articles coming soon')).toBeInTheDocument();
  });

  it('returns a 404 for an unknown slug', async () => {
    await expect(
      BlogPostPage({ params: Promise.resolve({ locale: 'en', slug: 'no-such-post' }) }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it.each([
    {
      locale: 'en',
      titles: [
        'How AI Transforms PDF Learning into Personalized Quizzes',
        "Knowledge Graphs and Bloom's Taxonomy: A Complete Guide",
      ],
      meta: 'March 27, 2026 · 8 min read',
    },
    {
      locale: 'vi',
      titles: [
        'AI biến tài liệu PDF thành quiz cá nhân hóa như thế nào?',
        'Đồ thị kiến thức và phân loại Bloom: Hướng dẫn toàn diện',
      ],
      meta: '27 tháng 3, 2026 · 8 phút đọc',
    },
  ])('lists the posts newest first on /$locale/blog', async ({ locale, titles, meta }) => {
    renderIn(locale, await BlogIndexPage({ params: Promise.resolve({ locale }) }));

    const cards = screen.getAllByRole('heading', { level: 2 });
    expect(cards.map((card) => card.textContent)).toEqual(titles);
    expect(screen.getByText(meta)).toBeInTheDocument();
    expect(cards[1]?.closest('a')).toHaveAttribute('href', `/${locale}/blog/${KNOWLEDGE_GRAPHS}`);
  });

  it.each(['en', 'vi'])('lists the author articles on /%s/blog/authors', async (locale) => {
    renderIn(
      locale,
      await AuthorPage({ params: Promise.resolve({ locale, slug: 'rinkuzu-team' }) }),
    );

    const articles = screen.getAllByRole('heading', { level: 3 });
    expect(articles).toHaveLength(2);
    expect(within(articles[0]?.closest('a') as HTMLElement).getByText(/2026/)).toBeInTheDocument();
    expect(articles[0]?.closest('a')).toHaveAttribute('href', `/${locale}/blog/${AI_GUIDE}`);
  });
});
