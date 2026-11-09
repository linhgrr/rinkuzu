import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '@/lib/blog/content';
import { blogMessages } from '../../../../../tests/helpers/blog-intl-mock';
import BlogPostPage from './[slug]/page';

// RIN-1387: the chrome around a post (CTA, share row, TOC, prev/next) comes from
// the `blog` messages, so /vi posts no longer render it in English.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/blog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next-intl/server', () => import('../../../../../tests/helpers/blog-intl-mock'));
vi.mock('@/components/blog/ReadingProgressBar', () => ({ ReadingProgressBar: () => null }));
vi.mock('@/components/ui/MarkdownRenderer', () => ({ MarkdownRenderer: () => null }));

const ctaOverride = vi.hoisted(() => ({
  value: undefined as Pick<BlogPost, 'ctaTitle' | 'ctaBody'> | undefined,
}));

vi.mock('@/lib/blog/posts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/blog/posts')>();
  return {
    ...actual,
    // A lone post: both prev/next placeholders render.
    getAdjacentBlogArticles: () => ({ previous: undefined, next: undefined }),
    // The real posts all set their own CTA: strip it so the default copy renders,
    // unless a test sets one.
    getBlogArticle: (locale: Parameters<typeof actual.getBlogArticle>[0], slug: string) => {
      const article = actual.getBlogArticle(locale, slug);
      if (!article) return article;
      const withoutCta: BlogPost = { ...article };
      delete withoutCta.ctaTitle;
      delete withoutCta.ctaBody;
      return { ...withoutCta, ...ctaOverride.value };
    },
  };
});

const SLUG = 'ai-powered-quiz-generation-guide';
const viBlog = blogMessages.vi;

const renderPost = async (locale: 'en' | 'vi') => {
  const page = await BlogPostPage({ params: Promise.resolve({ locale, slug: SLUG }) });
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {page}
    </NextIntlClientProvider>,
  );
};

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
  ctaOverride.value = undefined;
  vi.unstubAllGlobals();
});

describe('blog post chrome localization', () => {
  it('renders the English chrome exactly as before on /en', async () => {
    await renderPost('en');

    expect(
      screen.getByRole('heading', { name: 'Turn your PDF into personalized practice' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Upload a PDF and RinKuzu builds a personalized quiz from it, free.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute(
      'href',
      '/en/register?next=/adaptive/upload',
    );
    expect(screen.getByText('No credit card required · Free plan available')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the FAQ' })).toHaveAttribute('href', '/en/faq');
    expect(screen.getByText('Share this post:')).toBeInTheDocument();
    expect(screen.getByTitle('Share on Twitter')).toBeInTheDocument();
    expect(screen.getByTitle('Copy link')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Table of Contents' })).toBeInTheDocument();
    expect(screen.getByText('More articles coming soon')).toBeInTheDocument();
    expect(screen.getByText('No previous post')).toBeInTheDocument();
  });

  it('renders the chrome in Vietnamese from the vi messages on /vi', async () => {
    await renderPost('vi');

    expect(screen.getByRole('heading', { name: viBlog.cta.title })).toBeInTheDocument();
    expect(screen.getByText(viBlog.cta.body)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: viBlog.cta.button })).toHaveAttribute(
      'href',
      '/vi/register?next=/adaptive/upload',
    );
    expect(screen.getByText(viBlog.cta.reassurance)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: viBlog.cta.faqLink })).toHaveAttribute(
      'href',
      '/vi/faq',
    );
    expect(screen.getByText(viBlog.share.label)).toBeInTheDocument();
    expect(screen.getByTitle(viBlog.share.copyLink)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: viBlog.toc.heading })).toBeInTheDocument();
    expect(screen.getByText(viBlog.nav.moreSoon)).toBeInTheDocument();
    expect(screen.getByText(viBlog.nav.noPrevious)).toBeInTheDocument();
    expect(
      within(screen.getByRole('article')).getByRole('link', { name: viBlog.breadcrumbHome }),
    ).toHaveAttribute('href', '/vi');

    for (const english of [
      'Turn your PDF into personalized practice',
      'Get Started Free',
      'No credit card required · Free plan available',
      'Share this post:',
      'Table of Contents',
      'More articles coming soon',
    ]) {
      expect(screen.queryByText(english)).toBeNull();
    }
  });

  it('uses only the product term cá nhân hóa in the Vietnamese copy', () => {
    const copy = JSON.stringify(viBlog);
    expect(copy).toContain('cá nhân hóa');
    expect(copy).not.toMatch(/thích ứng/iu);
  });

  it.each(['en', 'vi'] as const)(
    'lets the post frontmatter override the default CTA on /%s',
    async (locale) => {
      ctaOverride.value = { ctaTitle: 'Fake CTA title', ctaBody: 'Fake CTA body' };
      await renderPost(locale);

      expect(screen.getByRole('heading', { name: 'Fake CTA title' })).toBeInTheDocument();
      expect(screen.getByText('Fake CTA body')).toBeInTheDocument();
      expect(screen.queryByText(blogMessages[locale].cta.title)).toBeNull();
      expect(screen.getByRole('link', { name: blogMessages[locale].cta.button })).toHaveAttribute(
        'href',
        `/${locale}/register?next=/adaptive/upload`,
      );
    },
  );
});
