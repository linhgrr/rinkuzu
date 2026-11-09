import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '@/lib/blog/content';
import BlogPostPage from './[slug]/page';

// RIN-1391: the article page chrome (breadcrumb, CTA, share, TOC, prev/next)
// follows the route locale; the article body and frontmatter CTA do not.

vi.mock('next-intl/server', () => import('../../../../../tests/helpers/next-intl-server'));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/blog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/components/blog/ReadingProgressBar', () => ({ ReadingProgressBar: () => null }));
vi.mock('@/components/ui/MarkdownRenderer', () => ({ MarkdownRenderer: () => null }));

const cta = vi.hoisted(() => ({ mode: 'none' as 'none' | 'strip' | 'set' }));

vi.mock('@/lib/blog/posts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/blog/posts')>();
  return {
    ...actual,
    getBlogArticle: (...args: Parameters<typeof actual.getBlogArticle>) => {
      const article = actual.getBlogArticle(...args);
      if (!article || cta.mode === 'none') return article;
      const { ctaTitle: _title, ctaBody: _body, ...rest } = article;
      return cta.mode === 'set'
        ? { ...rest, ctaTitle: 'Fake CTA title', ctaBody: 'Fake CTA body' }
        : (rest as BlogPost);
    },
  };
});

// Newest post first: it has a next article and no previous one.
const FIRST_SLUG = 'how-personalized-quiz-difficulty-works';
const LAST_SLUG = 'knowledge-graphs-adaptive-learning-pdfs';

const renderPost = async (locale: string, slug = FIRST_SLUG) => {
  const page = await BlogPostPage({ params: Promise.resolve({ locale, slug }) });
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
  cta.mode = 'none';
  vi.unstubAllGlobals();
});

const ctaBlock = () => screen.getByRole('link', { name: /get started free|bắt đầu miễn phí/i });

describe('blog article chrome on /vi', () => {
  it('renders the default CTA, share, TOC and breadcrumb in Vietnamese', async () => {
    cta.mode = 'strip';
    await renderPost('vi');

    expect(
      screen.getByRole('heading', { name: 'Biến tài liệu PDF thành bài luyện tập cá nhân hóa' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tải lên một tệp PDF, RinKuzu sẽ tạo quiz cá nhân hóa từ tài liệu đó, miễn phí.',
      ),
    ).toBeInTheDocument();
    expect(ctaBlock()).toHaveTextContent('Bắt đầu miễn phí');
    expect(screen.getByText('Không cần thẻ tín dụng · Có gói Miễn phí')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem Câu hỏi thường gặp' })).toBeInTheDocument();
    expect(screen.getByText('Chia sẻ bài viết:')).toBeInTheDocument();
    expect(screen.getByTitle('Chia sẻ lên Facebook')).toBeInTheDocument();
    expect(screen.getByTitle('Sao chép liên kết')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Mục lục' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toBeInTheDocument();
    expect(screen.queryByText(/Get Started Free|Share this post|Table of Contents/)).toBeNull();
  });

  it('renders the previous/next labels in Vietnamese', async () => {
    const { unmount } = await renderPost('vi', FIRST_SLUG);
    expect(screen.getByText('Bài trước')).toBeInTheDocument();
    expect(screen.getByText('Chưa có bài trước')).toBeInTheDocument();
    expect(screen.getByText('Bài tiếp theo')).toBeInTheDocument();
    unmount();

    await renderPost('vi', LAST_SLUG);
    expect(screen.getByText('Tiếp theo')).toBeInTheDocument();
    expect(screen.getByText('Sắp có thêm bài viết')).toBeInTheDocument();
  });
});

describe('blog article chrome on /en', () => {
  it('keeps the English copy', async () => {
    cta.mode = 'strip';
    await renderPost('en');

    expect(
      screen.getByRole('heading', { name: 'Turn your PDF into personalized practice' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Upload a PDF and RinKuzu builds a personalized quiz from it, free.'),
    ).toBeInTheDocument();
    expect(ctaBlock()).toHaveTextContent('Get Started Free');
    expect(screen.getByText('No credit card required · Free plan available')).toBeInTheDocument();
    expect(screen.getByText(/Questions about uploads or plans\?/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the FAQ' })).toBeInTheDocument();
    expect(screen.getByText('Share this post:')).toBeInTheDocument();
    expect(screen.getByTitle('Share on Twitter')).toBeInTheDocument();
    expect(screen.getByTitle('Copy link')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Table of Contents' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('No previous post')).toBeInTheDocument();
    expect(screen.getByText('Next Article')).toBeInTheDocument();
  });
});

describe('frontmatter CTA', () => {
  it.each(['en', 'vi'])('overrides the default CTA heading and body on /%s', async (locale) => {
    cta.mode = 'set';
    await renderPost(locale);
    expect(screen.getByRole('heading', { name: 'Fake CTA title' })).toBeInTheDocument();
    expect(screen.getByText('Fake CTA body')).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Turn your PDF into personalized practice|Biến tài liệu PDF thành bài luyện tập/,
      ),
    ).toBeNull();
  });
});
