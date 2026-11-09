import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { buildLocalizedMetadata } from '@/lib/seo';
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
        </div>
      </header>

      {/* Post list */}
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
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
