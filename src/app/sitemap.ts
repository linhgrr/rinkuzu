import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/config';
import { canonicalFor } from '@/lib/seo';
import { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';
import { serializeDate } from '@/lib/date-serialization';
import { loadPublicQuizSitemapEntries } from '@/lib/public-quiz-sitemap';

// Extended sitemap entry type that includes hreflang alternates.
// Next.js MetadataRoute.Sitemap doesn't expose the 'links' field directly,
// but the sitemap XML renderer supports it. We cast to extend the type.
type HreflangLink = { language: string; url: string };

type SitemapEntry = MetadataRoute.Sitemap[number] & {
  links?: HreflangLink[];
};

type LocaleRouteVariant = {
  locale: string;
  path: string;
};

function localeVariants(path: string): LocaleRouteVariant[] {
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

function toRequiredSitemapDate(value: Date | string, fieldName: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  serializeDate(date, fieldName);
  return date;
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

  const publicQuizzes = await loadPublicQuizSitemapEntries('sitemap: quiz generation failed');
  for (const quiz of publicQuizzes) {
    for (const { locale } of localeVariants(quiz.path)) {
      pushEntry(
        toEntry(locale, quiz.path, toRequiredSitemapDate(quiz.lastModified, 'quiz.updatedAt')),
      );
    }
  }

  // Ensure default locale root is first for consistency.
  entries.sort((a, b) => {
    if (a.url === canonicalFor(defaultLocale, '/')) return -1;
    if (b.url === canonicalFor(defaultLocale, '/')) return 1;
    return a.url.localeCompare(b.url);
  });

  return entries;
}
