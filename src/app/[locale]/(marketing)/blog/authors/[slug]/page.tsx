import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { buildLocalizedMetadata, canonicalFor, siteUrl } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { getBlogAuthor, type BlogAuthor } from '@/lib/blog/authors';
import { blogFeedAlternates } from '@/lib/blog/feed';
import {
  formatBlogDate,
  getBlogAuthorSlugs,
  getBlogPostsByAuthor,
  toBlogLocale,
} from '@/lib/blog/posts';

type Props = { params: Promise<{ locale: string; slug: string }> };

// Re-render at most hourly (ISR) so a post scheduled by a future `date` goes
// live on that day without a deploy, while crawlers still get a cached static
// page (RIN-1329, `isPublished` in src/lib/blog/posts.ts).
export const revalidate = 3600;

export function generateStaticParams(): Array<{ slug: string }> {
  return getBlogAuthorSlugs()
    .filter((slug) => getBlogAuthor(slug))
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = getBlogAuthor(slug, toBlogLocale(locale));
  if (!author) return {};

  return buildLocalizedMetadata({
    locale,
    path: `/blog/authors/${slug}`,
    alternateTypes: blogFeedAlternates(toBlogLocale(locale)),
    title:
      locale === 'vi'
        ? `${author.name} — Tác giả tại Blog RinKuzu`
        : `${author.name} — Author at RinKuzu Blog`,
    description: author.shortBio,
  });
}

function buildPersonSchema(author: BlogAuthor, locale: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: canonicalFor(locale, `/blog/authors/${author.slug}`),
    description: author.shortBio,
    worksFor: {
      '@type': 'Organization',
      name: 'RinKuzu / Hanoi University of Science and Technology',
      url: siteUrl.origin,
    },
  };
}

// NOTE: buildAuthorSchema removed — "@type: Author" is NOT a valid schema.org type.
// Only Person schema is used (valid per schema.org specification).
// See: https://schema.org/Person — use @type: Person for author identification.

export default async function AuthorPage({ params }: Props) {
  const { locale, slug } = await params;
  const author = getBlogAuthor(slug, toBlogLocale(locale));
  if (!author) return null;
  const isVi = locale === 'vi';
  const blogLocale = toBlogLocale(locale);
  const posts = getBlogPostsByAuthor(blogLocale, author.slug);

  const personSchema = buildPersonSchema(author, locale);

  return (
    <>
      <JsonLd id="person-schema" data={personSchema} />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="bg-[var(--bg-section)] py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-6">
            <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-12">
              <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
                {isVi ? 'Trang chủ' : 'Home'}
              </Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-[var(--text-primary)] transition-colors">
                Blog
              </Link>
              <span>/</span>
              <Link
                href="/blog/authors"
                className="hover:text-[var(--text-primary)] transition-colors"
              >
                {isVi ? 'Tác giả' : 'Authors'}
              </Link>
              <span>/</span>
              <span className="text-[var(--text-primary)]">{author.name}</span>
            </nav>

            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden bg-neutral-100 shadow-md">
                  <Image
                    src={author.imageUrl}
                    alt={`${author.name} — ${author.role}`}
                    width={144}
                    height={144}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-trust mb-2">
                  {author.role}
                </p>
                <h1 className="text-3xl md:text-4xl font-semibold text-[var(--text-primary)] mb-3 leading-tight">
                  {author.name}
                </h1>
                <p className="text-[var(--text-muted)] leading-relaxed text-base md:text-lg">
                  {author.shortBio}
                </p>
                {author.links.length > 0 && (
                  <div className="flex gap-3 mt-4">
                    {author.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-trust hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Articles by this author */}
        <section className="py-16 md:py-24">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-8">
              {isVi ? `Bài viết của ${author.name}` : `Articles by ${author.name}`}
            </h2>
            <div className="space-y-6">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex gap-5 rounded-2xl border border-neutral-200 p-5 transition-[border-color,box-shadow] hover:border-green-200 hover:shadow-md"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-brand-trust bg-green-50 px-2 py-0.5 rounded-full">
                        {post.category}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatBlogDate(post.date, blogLocale)}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-brand-trust transition-colors leading-snug mb-1">
                      {post.title}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-2">
                      {post.summary ?? post.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
