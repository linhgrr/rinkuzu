import { locales } from '@/i18n/config';
import { BLOG_FEED_CONTENT_TYPE, buildBlogFeed } from '@/lib/blog/feed';
import { toBlogLocale } from '@/lib/blog/posts';

type Context = { params: Promise<{ locale: string }> };

// Same cadence as the blog pages (RIN-1329): a static feed rebuilt at most
// hourly, so a post scheduled by a future `date` joins it on that day.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams(): Array<{ locale: string }> {
  return locales.map((locale) => ({ locale }));
}

/** `/vi/blog/rss.xml` and `/en/blog/rss.xml`: RSS 2.0 of that locale's posts (RIN-1330). */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { locale } = await params;
  return new Response(buildBlogFeed(toBlogLocale(locale)), {
    status: 200,
    headers: {
      'Content-Type': BLOG_FEED_CONTENT_TYPE,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
