import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import { buildLocalizedMetadata, canonicalFor, siteUrl } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';
import { ShareButtons, type ShareLabels } from '@/components/blog/ShareButtons';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { extractHeadingsFromMarkdown } from '@/lib/blog-utils';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { getBlogPostBySlug, type BlogPost } from '@/lib/blog/content';
import {
  formatBlogDate,
  formatReadTime,
  getAdjacentBlogArticles,
  getBlogArticle,
  getBlogArticleLocales,
  getBlogArticleSlugs,
  getRelatedBlogArticles,
  toBlogLocale,
} from '@/lib/blog/posts';
import { getBlogAuthor } from '@/lib/blog/authors';
import { hasInlineTryQuiz, splitBlogBody } from '@/lib/blog/try-quiz-marker';
import { toStableContentEntries } from '@/lib/collections/stable-content-entries';
import { TryQuizCard, type TryQuizCardLabels } from '@/features/landing/components/TryQuizCard';
import { blogFeedAlternates } from '@/lib/blog/feed';
import { RelatedPosts } from './RelatedPosts';

type Props = { params: Promise<{ locale: string; slug: string }> };
type BlogTranslator = Awaited<ReturnType<typeof getTranslations<'blog'>>>;

// Re-render at most hourly (ISR) so a post scheduled by a future `date` goes
// live on that day without a deploy, while crawlers still get a cached static
// page (RIN-1329, `isPublished` in src/lib/blog/posts.ts).
export const revalidate = 3600;

const SHARE_NETWORKS = ['Twitter', 'LinkedIn', 'Facebook'] as const;
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

export function generateStaticParams(): Array<{ slug: string }> {
  return getBlogArticleSlugs().map((slug) => ({ slug }));
}

const resolveArticle = async (params: Props['params']) => {
  const { locale, slug } = await params;
  const blogLocale = toBlogLocale(locale);
  const article = getBlogArticle(blogLocale, slug);
  return { locale, blogLocale, article };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, blogLocale, article } = await resolveArticle(params);
  if (!article) return {};

  const path = `/blog/${article.slug}`;
  const title = `${article.title} | RinKuzu`;
  const description = article.seoDescription ?? article.description;
  const publishedTime = `${article.date}T00:00:00.000Z`;
  const base = buildLocalizedMetadata({
    locale,
    path,
    title,
    description,
    imagePath: article.heroImage,
    alternateLocales: getBlogArticleLocales(article.slug),
    alternateTypes: blogFeedAlternates(blogLocale),
  });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      title,
      description,
      type: 'article',
      publishedTime,
      modifiedTime: publishedTime,
      authors: [canonicalFor(locale, `/blog/authors/${article.author}`)],
      images: [
        {
          url: article.heroImage,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: article.heroImageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: article.twitterDescription ?? description,
      images: [article.heroImage],
    },
  };
}

function buildArticleSchema(article: BlogPost, authorName: string) {
  const url = `${siteUrl.origin}/blog/${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    name: article.title,
    headline: article.title,
    description: article.seoDescription ?? article.description,
    url,
    datePublished: article.date,
    dateModified: article.date,
    author: {
      '@type': 'Person',
      name: authorName,
      url: `${siteUrl.origin}/blog/authors/${article.author}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'RinKuzu',
      url: siteUrl.origin,
      logo: `${siteUrl.origin}/icons/icon-512x512.png`,
    },
    mainEntityOfPage: { '@type': 'WebPage', url },
    image: {
      '@type': 'ImageObject',
      url: article.heroImage,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    },
    ...(article.wordCount ? { wordCount: article.wordCount } : {}),
    ...(article.timeRequiredMinutes ? { timeRequired: `PT${article.timeRequiredMinutes}M` } : {}),
  };
}

function buildBreadcrumbSchema(article: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl.origin },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl.origin}/blog` },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: `${siteUrl.origin}/blog/${article.slug}`,
      },
    ],
  };
}

function PostNavigation({ article, t }: { article: BlogPost; t: BlogTranslator }) {
  const { previous, next } = getAdjacentBlogArticles(article);
  return (
    <div className="mt-16 pt-10 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-6">
      {previous ? (
        <Link
          href={`/blog/${previous.slug}`}
          className="flex flex-col gap-1 text-left group w-full sm:w-auto"
        >
          <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
            {t('nav.previous')}
          </span>
          <span className="text-[var(--text-primary)] font-bold group-hover:text-brand-trust transition-colors">
            ← {previous.navLabel ?? previous.title}
          </span>
        </Link>
      ) : (
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
            {t('nav.previous')}
          </span>
          <span className="text-neutral-300">{t('nav.noPrevious')}</span>
        </div>
      )}
      {next ? (
        <Link
          href={`/blog/${next.slug}`}
          className="flex flex-col gap-1 text-right group w-full sm:w-auto"
        >
          <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
            {t('nav.nextArticle')}
          </span>
          <span className="text-[var(--text-primary)] font-bold group-hover:text-brand-trust transition-colors">
            {next.navLabel ?? next.title} →
          </span>
        </Link>
      ) : (
        <div className="flex flex-col gap-1 text-right w-full sm:w-auto">
          <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
            {t('nav.next')}
          </span>
          <span className="text-neutral-300">{t('nav.moreSoon')}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The body with its quiz cards (RIN-1258): one at each `<TryQuiz />` line, else one
 * after the body when the frontmatter has a `quiz` block, else none.
 */
function ArticleBody({
  article,
  locale,
  labels,
}: {
  article: BlogPost;
  locale: string;
  labels: TryQuizCardLabels;
}) {
  const segments = splitBlogBody(article.content);
  // Content-derived keys: a duplicate segment keeps its occurrence number.
  const keys = toStableContentEntries(
    segments.map((segment) =>
      segment.kind === 'markdown' ? `md:${segment.content}` : `quiz:${segment.teaser ?? ''}`,
    ),
  ).map((entry) => entry.key);
  const card = (position: 'blog_inline' | 'blog_end', teaser: string | undefined) => (
    <div className="my-12">
      <TryQuizCard
        labels={labels}
        position={position}
        locale={locale}
        post={article.slug}
        quiz={article.quiz?.slug}
        teaser={teaser}
      />
    </div>
  );
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === 'markdown' ? (
          <MarkdownRenderer key={keys[index]} content={segment.content} headingIds />
        ) : (
          <Fragment key={keys[index]}>
            {card('blog_inline', segment.teaser ?? article.quiz?.teaser)}
          </Fragment>
        ),
      )}
      {article.quiz && !hasInlineTryQuiz(segments) ? card('blog_end', article.quiz.teaser) : null}
    </>
  );
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, blogLocale, article } = await resolveArticle(params);
  if (!article) notFound();

  // A listing-only translation renders the English article; its related cards
  // still come from the route locale's own listing (RIN-1331).
  const relatedPosts = getRelatedBlogArticles(
    getBlogPostBySlug(blogLocale, article.slug) ?? article,
  );

  const author = getBlogAuthor(article.author);
  const authorName = author?.name ?? article.author;
  const postUrl = canonicalFor(locale, `/blog/${article.slug}`);
  const headings = extractHeadingsFromMarkdown(article.content);
  const readTime = article.articleReadTimeMinutes ?? article.readTimeMinutes;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const tryQuizLabels = {
    heading: t('tryQuiz.heading'),
    meta: t('tryQuiz.meta'),
    button: t('tryQuiz.button'),
  };
  const shareLabels = {
    label: t('share.label'),
    copyLink: t('share.copyLink'),
    copied: t('share.copied'),
    copyFailed: t('share.copyFailed'),
    shareOn: Object.fromEntries(
      SHARE_NETWORKS.map((network) => [network, t('share.shareOn', { network })]),
    ) as ShareLabels['shareOn'],
  };

  return (
    <article className="min-h-screen bg-white">
      <ReadingProgressBar />
      <JsonLd id="article-schema" data={buildArticleSchema(article, authorName)} />
      <JsonLd id="breadcrumb-schema" data={buildBreadcrumbSchema(article)} />

      {/* Hero */}
      <header className="bg-[var(--bg-section)] border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-12">
          <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
              {t('breadcrumbHome')}
            </Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-[var(--text-primary)] transition-colors">
              Blog
            </Link>
            <span>/</span>
            <span className="text-[var(--text-primary)]">
              {article.breadcrumbLabel ?? article.title}
            </span>
          </nav>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-trust bg-green-50 px-3 py-1 rounded-full">
              {article.category}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {formatBlogDate(article.date, article.locale)} ·{' '}
              {formatReadTime(readTime, article.locale)}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold text-[var(--text-primary)] leading-tight mb-6">
            {article.title}
          </h1>
          <p className="text-xl text-[var(--text-muted)] leading-relaxed font-medium">
            {article.lede ?? article.description}
          </p>
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-neutral-100">
            <div className="size-11 rounded-full bg-[var(--text-primary)] flex items-center justify-center text-white font-bold text-sm ring-4 ring-white shadow-sm">
              {author?.initials ?? authorName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <Link
                href={`/blog/authors/${article.author}`}
                className="text-sm font-semibold text-[var(--text-primary)] hover:text-brand-trust transition-colors"
              >
                {authorName}
              </Link>
              {author?.tagline ? (
                <p className="text-xs text-[var(--text-muted)]">{author.tagline}</p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Article body: centered content, ToC fixed to the right */}
      <div className="max-w-7xl mx-auto px-6 py-12 relative">
        {/* Hero image */}
        <div className="mb-12 max-w-3xl mx-auto">
          <div className="rounded-3xl overflow-hidden shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] ring-1 ring-black/5">
            <Image
              src={article.heroImage}
              alt={article.heroImageAlt}
              width={900}
              height={500}
              className="w-full object-cover aspect-[16/9]"
              priority
            />
          </div>
        </div>

        {/* Article content — centered */}
        <div className="max-w-3xl mx-auto">
          <ArticleBody article={article} locale={locale} labels={tryQuizLabels} />

          <ShareButtons url={postUrl} title={article.title} labels={shareLabels} />

          {/* CTA */}
          <div className="mt-16 bg-gradient-to-br from-[var(--text-primary)] to-[#2d2d2f] rounded-[2rem] p-10 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 size-64 bg-green-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 size-64 bg-green-500/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
            <div className="relative z-10 text-center max-w-xl mx-auto">
              <h3 className="text-2xl md:text-3xl font-semibold mb-4">
                {article.ctaTitle ?? t('cta.title')}
              </h3>
              <p className="text-neutral-300 text-lg mb-8">{article.ctaBody ?? t('cta.body')}</p>
              <Link
                href="/register?next=/adaptive/upload"
                className="inline-flex items-center justify-center rounded-full bg-brand-trust px-10 py-4 font-bold text-white shadow-lg shadow-green-500/20 transition-[background-color,transform] hover:scale-105 hover:bg-brand-trust-hover active:scale-95"
              >
                {t('cta.button')}
              </Link>
              <p className="mt-4 text-xs text-neutral-400">{t('cta.reassurance')}</p>
              <p className="mt-2 text-sm text-neutral-300">
                {t('cta.faqPrompt')}{' '}
                <Link href="/faq" className="underline hover:text-white">
                  {t('cta.faqLink')}
                </Link>
              </p>
            </div>
          </div>

          <RelatedPosts posts={relatedPosts} locale={blogLocale} />

          <PostNavigation article={article} t={t} />
        </div>

        {/* Table of Contents — right, fixed to container edge */}
        <aside className="hidden xl:block absolute right-6 top-12 w-56 flex-shrink-0">
          <div className="sticky top-24">
            <TableOfContents headings={headings} title={t('toc.heading')} />
          </div>
        </aside>
      </div>
    </article>
  );
}
