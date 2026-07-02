/**
 * Locale-specific XML sitemap for /en/sitemap.xml, /vi/sitemap.xml
 *
 * Next.js automatically generates a sitemap from src/app/sitemap.ts at the root.
 * This locale-scoped sitemap serves the same URLs but prefixed with the locale path
 * (e.g., /en/, /en/pricing, /en/faq) to support crawlers that look for
 * locale-specific sitemaps.
 */

import type { MetadataRoute } from 'next';
import { serviceFactory } from '@/lib/serviceFactory';
import { locales, type Locale } from '@/i18n/config';
import { canonicalFor } from '@/lib/seo';
import { INDEXABLE_STATIC_PUBLIC_ROUTES } from '@/lib/seo.routes';
import { logger } from '@/lib/logger';
import { toUtcDateKey } from '@/lib/date-serialization';

function toEntry(
  locale: Locale | string,
  path: string,
  lastModified = new Date(),
): MetadataRoute.Sitemap[number] {
  return {
    url: canonicalFor(locale, path),
    lastModified,
  };
}

function getRequiredLastModifiedDate(entry: MetadataRoute.Sitemap[number]): Date {
  if (!entry.lastModified) {
    throw new TypeError('sitemap.lastModified must be present');
  }

  return entry.lastModified instanceof Date ? entry.lastModified : new Date(entry.lastModified);
}

export async function GET(): Promise<Response> {
  const entries: MetadataRoute.Sitemap = [];
  const seenUrls = new Set<string>();

  const pushEntry = (entry: MetadataRoute.Sitemap[number]) => {
    if (seenUrls.has(entry.url)) return;
    seenUrls.add(entry.url);
    entries.push(entry);
  };

  // Static public routes for each locale
  for (const locale of [...locales]) {
    for (const route of INDEXABLE_STATIC_PUBLIC_ROUTES) {
      pushEntry(toEntry(locale, route));
    }
  }

  // Public quizzes
  const quizService = serviceFactory.getQuizService();
  try {
    const quizResult = await quizService.getQuizzes({
      isPrivate: false,
      page: 1,
      limit: 5000,
      compact: true,
      onlyMine: false,
    });
    for (const quiz of quizResult.quizzes) {
      const path = `/quiz/${quiz.slug}`;
      const quizDate = new Date(quiz.updatedAt ?? quiz.createdAt);
      for (const locale of [...locales]) {
        pushEntry(toEntry(locale, path, quizDate));
      }
    }
  } catch (error) {
    logger.error({ error }, 'locale sitemap: quiz generation failed');
  }

  // Sort
  entries.sort((a, b) => a.url.localeCompare(b.url));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${toUtcDateKey(getRequiredLastModifiedDate(e), 'sitemap.lastModified')}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
