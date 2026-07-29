/**
 * Locale-specific XML sitemap for /en/sitemap.xml, /vi/sitemap.xml
 *
 * Next.js automatically generates a sitemap from src/app/sitemap.ts at the root.
 * This locale-scoped sitemap serves the same URLs but prefixed with the locale path
 * (e.g., /en/, /en/pricing, /en/faq) to support crawlers that look for
 * locale-specific sitemaps.
 */

import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/config';
import { canonicalFor } from '@/lib/seo';
import { toUtcDateKey } from '@/lib/date-serialization';
import { buildPublicSitemapEntries } from '@/lib/public-sitemap';

function getRequiredLastModifiedDate(entry: MetadataRoute.Sitemap[number]): Date {
  if (!entry.lastModified) {
    throw new TypeError('sitemap.lastModified must be present');
  }

  return entry.lastModified instanceof Date ? entry.lastModified : new Date(entry.lastModified);
}

function buildHreflangXml(path: string): string {
  const links = [
    ...locales.map((locale) => ({
      language: locale,
      url: canonicalFor(locale, path),
    })),
    {
      language: 'x-default',
      url: canonicalFor(defaultLocale, path),
    },
  ];

  return links
    .map(
      ({ language, url }) =>
        `    <xhtml:link rel="alternate" hreflang="${language}" href="${url}" />`,
    )
    .join('\n');
}

export async function GET(): Promise<Response> {
  const entries = await buildPublicSitemapEntries('locale sitemap: quiz generation failed');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.url}</loc>
${buildHreflangXml(new URL(e.url).pathname.replace(/^\/(?:vi|en)(?=\/|$)/, '') || '/')}
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
