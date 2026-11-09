import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import type { Locale } from '@/i18n/config';
import type { BlogPost } from '@/lib/blog/content';
import { blogImageAt, formatBlogDate, formatReadTime } from '@/lib/blog/posts';

const HEADING_ID = 'related-posts-heading';
const THUMBNAIL_WIDTH = 600;

type Props = { posts: BlogPost[]; locale: Locale };

/**
 * Related articles below the post's CTA (RIN-1331): compact blog index cards,
 * one column on mobile and two from `md`, an odd last card spanning the row.
 * Renders nothing when no post is related.
 */
export function RelatedPosts({ posts, locale }: Props) {
  if (posts.length === 0) return null;
  const isVi = locale === 'vi';

  return (
    <section aria-labelledby={HEADING_ID} className="mt-16">
      <h2 id={HEADING_ID} className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
        {isVi ? 'Bài viết liên quan' : 'Related articles'}
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {posts.map((post, index) => {
          const spansRow = index === posts.length - 1 && posts.length % 2 === 1;
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className={`group block min-w-0 rounded-3xl overflow-hidden border border-neutral-200 transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-xl${spansRow ? ' md:col-span-2' : ''}`}
            >
              <div className="relative aspect-[16/7] overflow-hidden bg-neutral-50">
                <Image
                  src={blogImageAt(post.heroImage, THUMBNAIL_WIDTH)}
                  alt={post.heroImageAlt}
                  fill
                  loading="lazy"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes={
                    spansRow ? '(max-width: 768px) 100vw, 720px' : '(max-width: 768px) 100vw, 360px'
                  }
                />
              </div>
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-trust bg-green-50 px-3 py-1 rounded-full">
                    {post.category}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatBlogDate(post.date, locale)} ·{' '}
                    {formatReadTime(post.readTimeMinutes, locale)}
                  </span>
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-[var(--text-primary)] mb-3 group-hover:text-brand-trust transition-colors leading-snug break-words">
                  {post.title}
                </h3>
                <p className="hidden md:line-clamp-2 text-[var(--text-muted)] leading-relaxed mb-4">
                  {post.description}
                </p>
                <span className="text-sm font-semibold text-brand-trust group-hover:underline">
                  {isVi ? 'Đọc bài viết →' : 'Read article →'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
