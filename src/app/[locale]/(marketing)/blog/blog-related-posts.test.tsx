import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '@/lib/blog/content';
import BlogPostPage from './[slug]/page';

// RIN-1331: related posts sit between the single product CTA and prev/next.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/blog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next-intl/server', () => import('../../../../../tests/helpers/blog-intl-mock'));
vi.mock('@/components/blog/ReadingProgressBar', () => ({ ReadingProgressBar: () => null }));
vi.mock('@/components/blog/ShareButtons', () => ({ ShareButtons: () => null }));
vi.mock('@/components/blog/TableOfContents', () => ({ TableOfContents: () => null }));
vi.mock('@/components/ui/MarkdownRenderer', () => ({ MarkdownRenderer: () => null }));

const related = vi.hoisted(() => ({ override: undefined as BlogPost[] | undefined }));

vi.mock('@/lib/blog/posts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/blog/posts')>();
  return {
    ...actual,
    getRelatedBlogArticles: (post: BlogPost, limit?: number) =>
      related.override ?? actual.getRelatedBlogArticles(post, limit),
  };
});

const SLUG = 'ai-powered-quiz-generation-guide';
const OTHER_SLUG = 'knowledge-graphs-adaptive-learning-pdfs';

const fakePost = (slug: string): BlogPost => ({
  slug,
  title: `Fake post ${slug}`,
  description: 'Fake description',
  date: '2026-02-01',
  category: 'Guides',
  readTimeMinutes: 4,
  heroImage: '/hero.jpg',
  heroImageAlt: 'Hero',
  locale: 'en',
  author: 'rinkuzu-team',
  content: 'Body',
});

const renderPost = async (locale: string, slug = SLUG) => {
  const page = await BlogPostPage({ params: Promise.resolve({ locale, slug }) });
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {page}
    </NextIntlClientProvider>,
  );
};

const relatedSection = () => screen.queryByRole('region', { name: /related articles/i });

afterEach(() => {
  related.override = undefined;
});

describe('blog post related articles', () => {
  it('renders no related block when nothing is related', async () => {
    related.override = [];
    await renderPost('en');

    expect(relatedSection()).toBeNull();
    expect(screen.queryByRole('heading', { name: /related/i })).toBeNull();
  });

  it('links the one related post on its locale, after the single CTA', async () => {
    const { container } = await renderPost('en');

    const section = relatedSection();
    expect(section).not.toBeNull();
    const links = within(section as HTMLElement).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([`/en/blog/${OTHER_SLUG}`]);

    const ctas = container.querySelectorAll('a[href="/en/register?next=/adaptive/upload"]');
    expect(ctas).toHaveLength(1);
    const cta = ctas[0] as Element;
    const previous = screen.getByText('Previous');
    expect(cta.compareDocumentPosition(section as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      (section as Node).compareDocumentPosition(previous) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders three cards, the third spanning the row', async () => {
    related.override = ['one', 'two', 'three'].map(fakePost);
    await renderPost('en');

    const links = within(relatedSection() as HTMLElement).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/en/blog/one',
      '/en/blog/two',
      '/en/blog/three',
    ]);
    expect(links[2]?.className).toContain('md:col-span-2');
    expect(links[1]?.className).not.toContain('md:col-span-2');
  });

  it('shows Vietnamese copy and the Vietnamese listing on /vi', async () => {
    await renderPost('vi');

    const section = screen.getByRole('region', { name: 'Bài viết liên quan' });
    const link = within(section).getByRole('link');
    expect(link.getAttribute('href')).toBe(`/vi/blog/${OTHER_SLUG}`);
    expect(link.textContent).toContain('Đồ thị kiến thức');
    expect(screen.getByRole('link', { name: 'Bắt đầu miễn phí' }).getAttribute('href')).toBe(
      '/vi/register?next=/adaptive/upload',
    );
  });
});
