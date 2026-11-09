import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { TryQuizCard } from '@/features/landing/components/TryQuizCard';
import { buildLocalizedMetadata } from '@/lib/seo';
import { BLOG_FEED_PATH, blogFeedAlternates } from '@/lib/blog/feed';
import {
  blogImageAt,
  formatBlogDate,
  formatReadTime,
  getBlogIndexPosts,
  toBlogLocale,
} from '@/lib/blog/posts';

type Props = { params: Promise<{ locale: string }> };

// Re-render at most hourly (ISR) so a post scheduled by a future `date` goes
// live on that day without a deploy, while crawlers still get a cached static
// page (RIN-1329, `isPublished` in src/lib/blog/posts.ts).
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return buildLocalizedMetadata({
    locale,
    path: '/blog',
    alternateTypes: blogFeedAlternates(toBlogLocale(locale)),
    title: isVi
      ? 'Blog RinKuzu — Học cá nhân hóa, AI giáo dục và đồ thị kiến thức'
      : 'RinKuzu Blog — Personalized Learning, AI in Education & Knowledge Graphs',
    description: isVi
      ? 'Bài viết về học cá nhân hóa, xây dựng đồ thị kiến thức, phân loại Bloom và cách biến tài liệu PDF thành lộ trình luyện tập cá nhân hóa.'
      : "Insights on personalized learning, knowledge graph construction, Bloom's Taxonomy in practice, and turning PDFs into personalized practice paths.",
  });
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const blogLocale = toBlogLocale(locale);
  const posts = getBlogIndexPosts(blogLocale);
  const t = await getTranslations({ locale, namespace: 'blog' });

  return (
    <article className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-[var(--bg-section)] border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-12">
          <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
              {isVi ? 'Trang chủ' : 'Home'}
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)] font-medium">Blog</span>
          </nav>
          <h1 className="text-3xl md:text-5xl font-semibold text-[var(--text-primary)] leading-tight mb-4">
            RinKuzu Blog
          </h1>
          <p className="text-lg text-[var(--text-muted)] leading-relaxed max-w-2xl">
            {isVi
              ? 'Kiến thức thực tiễn về học cá nhân hóa, AI trong giáo dục, đồ thị kiến thức và cách biến PDF bài giảng thành lộ trình luyện tập cá nhân hóa.'
              : 'Insights on personalized learning, AI in education, knowledge graphs, and turning PDF lectures into personalized practice journeys.'}
          </p>
          {/* A plain anchor: the feed is a route handler, not a page to prefetch (RIN-1330). */}
          <a
            href={`/${blogLocale}${BLOG_FEED_PATH}`}
            type="application/rss+xml"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-trust hover:underline"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36ZM4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44Zm0 5.66A9.9 9.9 0 0 1 13.9 20h-2.83A7.07 7.07 0 0 0 4 12.93V10.1Z" />
            </svg>
            {isVi ? 'Theo dõi qua RSS' : 'Subscribe via RSS'}
          </a>
        </div>
      </header>

      {/* Post list, after the quiz card (RIN-1258: no post on the index) */}
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        <TryQuizCard
          labels={{
            heading: t('tryQuiz.heading'),
            meta: t('tryQuiz.meta'),
            button: t('tryQuiz.button'),
          }}
          position="blog_index"
          locale={locale}
        />
        {posts.map((post, index) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-3xl overflow-hidden border border-neutral-200 transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-xl"
          >
            {/* Thumbnail */}
            <div className="relative aspect-[16/7] overflow-hidden bg-neutral-50">
              <Image
                src={blogImageAt(post.heroImage, 800)}
                alt={post.heroImageAlt}
                fill
                // The first thumbnail is the LCP element (RIN-683): load it eagerly at high
                // priority; the cards below stay lazy.
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : undefined}
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 720px"
              />
            </div>

            {/* Card body */}
            <div className="p-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-trust bg-green-50 px-3 py-1 rounded-full">
                  {post.category}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {formatBlogDate(post.date, blogLocale)} ·{' '}
                  {formatReadTime(post.readTimeMinutes, blogLocale)}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-[var(--text-primary)] mb-3 group-hover:text-brand-trust transition-colors leading-snug">
                {post.title}
              </h2>
              <p className="text-[var(--text-muted)] leading-relaxed line-clamp-3 mb-4">
                {post.description}
              </p>
              <span className="text-sm font-semibold text-brand-trust group-hover:underline">
                {isVi ? 'Đọc bài viết →' : 'Read article →'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}
