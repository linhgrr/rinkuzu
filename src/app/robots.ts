import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/config';
import { siteUrl } from '@/lib/seo';
import { PRIVATE_ROUTE_PREFIXES } from '@/lib/seo.routes';

function localizedDisallow(path: string): string[] {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return locales.map((locale) => (locale === defaultLocale ? normalized : `/${locale}${normalized}`));
}

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    ...PRIVATE_ROUTE_PREFIXES.flatMap((path) => localizedDisallow(path)),
    '/api/',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${siteUrl.origin}/sitemap.xml`,
    host: siteUrl.origin,
  };
}
