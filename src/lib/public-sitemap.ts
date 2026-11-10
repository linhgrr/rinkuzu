import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/config';
import { getBlogLastModified, getBlogSitemapRoutes } from '@/lib/blog/posts';
import { serializeDate } from '@/lib/date-serialization';
import { loadPublicQuizSitemapEntries } from '@/lib/public-quiz-sitemap';
import { canonicalFor, languageAlternates } from '@/lib/seo';
import { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';
import { STATIC_ROUTE_LASTMOD } from '@/lib/seo/static-lastmod';
import { loadIndexableTopicHubs, topicHubPath } from '@/lib/seo/topic-hub';

function toEntry(
  locale: string,
  path: string,
  lastModified: Date,
  pageLocales: readonly string[] = locales,
): MetadataRoute.Sitemap[number] {
  return {
    url: canonicalFor(locale, path),
    lastModified,
    alternates: {
      languages: languageAlternates(path, pageLocales),
    },
  };
}

/** A quiz or a topic hub exists in one language: one URL, no hreflang pair (RIN-1241 D14). */
function toSingleLocaleEntry(
  locale: string,
  path: string,
  lastModified: Date,
): MetadataRoute.Sitemap[number] {
  return { url: canonicalFor(locale, path), lastModified };
}

/** `YYYY-MM-DD` → midnight UTC, the `lastmod` of a page dated by day. */
const fromDateKey = (dateKey: string): Date => new Date(`${dateKey}T00:00:00.000Z`);

/**
 * A static page's `lastmod` (RIN-1499): its constant; the blog index and the
 * author list also move with their newest post. Never the request time.
 */
function staticRouteLastModified(
  route: keyof typeof STATIC_ROUTE_LASTMOD,
  blogLastModified: string | undefined,
): Date {
  const constant = STATIC_ROUTE_LASTMOD[route];
  if (!route.startsWith('/blog') || !blogLastModified) return fromDateKey(constant);
  return fromDateKey(blogLastModified > constant ? blogLastModified : constant);
}

function toRequiredSitemapDate(value: Date | string, fieldName: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  serializeDate(date, fieldName);
  return date;
}

export async function buildPublicSitemapEntries(
  errorMessage: string,
): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const seenUrls = new Set<string>();

  const pushEntry = (entry: MetadataRoute.Sitemap[number]) => {
    if (seenUrls.has(entry.url)) return;
    seenUrls.add(entry.url);
    entries.push(entry);
  };

  const blogLastModified = getBlogLastModified();
  for (const route of INDEXABLE_STATIC_PUBLIC_ROUTES) {
    const lastModified = staticRouteLastModified(route, blogLastModified);
    for (const locale of locales) {
      pushEntry(toEntry(locale, route, lastModified));
    }
  }

  for (const route of getBlogSitemapRoutes()) {
    const lastModified = fromDateKey(route.lastModified);
    // An article is listed only in the locales it renders in (RIN-1312).
    const routeLocales = route.locales ?? locales;
    for (const locale of routeLocales) {
      pushEntry(toEntry(locale, route.path, lastModified, routeLocales));
    }
  }

  const publicQuizzes = await loadPublicQuizSitemapEntries(errorMessage);
  for (const quiz of publicQuizzes) {
    pushEntry(
      toSingleLocaleEntry(
        quiz.locale,
        quiz.path,
        toRequiredSitemapDate(quiz.lastModified, 'quiz.updatedAt'),
      ),
    );
  }

  // Hubs that pass `isTopicIndexable` only (RIN-1249, spec B5/D15).
  const hubs = await loadIndexableTopicHubs(errorMessage);
  for (const hub of hubs) {
    pushEntry(
      toSingleLocaleEntry(
        hub.locale,
        topicHubPath(hub.slug),
        toRequiredSitemapDate(hub.lastModified, 'topic.lastModified'),
      ),
    );
  }

  entries.sort((a, b) => {
    if (a.url === canonicalFor(defaultLocale, '/')) return -1;
    if (b.url === canonicalFor(defaultLocale, '/')) return 1;
    return a.url.localeCompare(b.url);
  });

  return entries;
}
