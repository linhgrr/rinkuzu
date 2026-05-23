import type { MetadataRoute } from 'next';
import { serviceFactory } from '@/lib/serviceFactory';
import { defaultLocale, locales } from '@/i18n/config';
import { canonicalFor } from '@/lib/seo';
import { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';
import { logger } from '@/lib/logger';

// Extended sitemap entry type that includes hreflang alternates.
// Next.js MetadataRoute.Sitemap doesn't expose the 'links' field directly,
// but the sitemap XML renderer supports it. We cast to extend the type.
type HreflangLink = { language: string; url: string };

type SitemapEntry = MetadataRoute.Sitemap[number] & {
  links?: HreflangLink[];
};

function localeVariants(path: string): { locale: string; path: string }[] {
  return locales.map((locale) => ({ locale, path }));
}

function buildHreflangLinks(path: string): HreflangLink[] {
  return locales.map((locale) => ({
    language: locale,
    url: canonicalFor(locale, path),
  }));
}

function toEntry(locale: string, path: string, lastModified = new Date()): SitemapEntry {
  return {
    url: canonicalFor(locale, path),
    lastModified,
    links: buildHreflangLinks(path),
  };
}

export default async function sitemap(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  const seenUrls = new Set<string>();

  const pushEntry = (entry: SitemapEntry) => {
    if (seenUrls.has(entry.url)) return;
    seenUrls.add(entry.url);
    entries.push(entry);
  };

  for (const route of INDEXABLE_STATIC_PUBLIC_ROUTES) {
    for (const { locale } of localeVariants(route)) {
      pushEntry(toEntry(locale, route));
    }
  }

  const quizService = serviceFactory.getQuizService();

  try {
    const quizResult = await quizService.getQuizzes({
      status: 'published',
      isPrivate: false,
      page: 1,
      limit: 5000,
      compact: true,
    });

    for (const quiz of quizResult.quizzes || []) {
      if (!quiz?.slug) continue;
      const path = `/quiz/${quiz.slug}`;
      const quizUpdatedAt = quiz.updatedAt || quiz.createdAt;

      for (const { locale } of localeVariants(path)) {
        pushEntry(toEntry(locale, path, new Date(quizUpdatedAt || Date.now())));
      }
    }
  } catch (error) {
    logger.error({ error }, 'sitemap quiz generation failed');
  }

  // Ensure default locale root is first for consistency.
  entries.sort((a, b) => {
    if (a.url === canonicalFor(defaultLocale, '/')) return -1;
    if (b.url === canonicalFor(defaultLocale, '/')) return 1;
    return a.url.localeCompare(b.url);
  });

  return entries;
}
