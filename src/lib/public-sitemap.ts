import type { MetadataRoute } from 'next';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { serializeDate } from '@/lib/date-serialization';
import { loadPublicQuizSitemapEntries } from '@/lib/public-quiz-sitemap';
import { canonicalFor } from '@/lib/seo';
import { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';

function buildLanguageAlternates(
  path: string,
  pathLocales: readonly Locale[],
): Record<string, string> {
  const languages = Object.fromEntries(
    pathLocales.map((locale) => [locale, canonicalFor(locale, path)]),
  );
  const xDefault = pathLocales.includes(defaultLocale)
    ? defaultLocale
    : (pathLocales[0] ?? defaultLocale);
  return {
    ...languages,
    'x-default': canonicalFor(xDefault, path),
  };
}

function toEntry(
  locale: string,
  path: string,
  lastModified = new Date(),
  pathLocales: readonly Locale[] = locales,
): MetadataRoute.Sitemap[number] {
  return {
    url: canonicalFor(locale, path),
    lastModified,
    alternates: {
      languages: buildLanguageAlternates(path, pathLocales),
    },
  };
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

  const publicQuizzes = await loadPublicQuizSitemapEntries(errorMessage);
  for (const quiz of publicQuizzes) {
    // A Vietnamese quiz is listed under /vi only (RIN-1265).
    const lastModified = toRequiredSitemapDate(quiz.lastModified, 'quiz.updatedAt');
    for (const locale of quiz.locales) {
      pushEntry(toEntry(locale, quiz.path, lastModified, quiz.locales));
    }
  }

  entries.sort((a, b) => {
    if (a.url === canonicalFor(defaultLocale, '/')) return -1;
    if (b.url === canonicalFor(defaultLocale, '/')) return 1;
    return a.url.localeCompare(b.url);
  });

  return entries;
}
