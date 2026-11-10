import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/config';
import { getBlogSitemapRoutes } from '@/lib/blog/posts';
import { serializeDate } from '@/lib/date-serialization';
import { loadPublicQuizSitemapEntries } from '@/lib/public-quiz-sitemap';
import { canonicalFor, languageAlternates } from '@/lib/seo';
import { DATED_STATIC_PUBLIC_ROUTES, INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';
import { loadIndexableTopicHubs, topicHubPath } from '@/lib/seo/topic-hub';

function toEntry(
  locale: string,
  path: string,
  lastModified = new Date(),
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

  for (const route of INDEXABLE_STATIC_PUBLIC_ROUTES) {
    for (const locale of locales) {
      pushEntry(toEntry(locale, route));
    }
  }

  for (const route of DATED_STATIC_PUBLIC_ROUTES) {
    const lastModified = new Date(`${route.lastModified}T00:00:00.000Z`);
    for (const locale of locales) {
      pushEntry(toEntry(locale, route.path, lastModified));
    }
  }

  for (const route of getBlogSitemapRoutes()) {
    const lastModified = new Date(`${route.lastModified}T00:00:00.000Z`);
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
