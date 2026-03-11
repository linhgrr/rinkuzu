import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/config';
import { siteUrl } from '@/lib/seo';

function localizedDisallow(path: string): string[] {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return locales.map((locale) => (locale === defaultLocale ? normalized : `/${locale}${normalized}`));
}

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    ...localizedDisallow('/admin'),
    ...localizedDisallow('/dashboard'),
    ...localizedDisallow('/profile'),
    ...localizedDisallow('/history'),
    ...localizedDisallow('/review'),
    ...localizedDisallow('/setup'),
    ...localizedDisallow('/subscription'),
    ...localizedDisallow('/create'),
    ...localizedDisallow('/adaptive-learning'),
    ...localizedDisallow('/draft'),
    ...localizedDisallow('/edit'),
    ...localizedDisallow('/login'),
    ...localizedDisallow('/register'),
    ...localizedDisallow('/payment'),
    ...localizedDisallow('/quiz/*/result'),
    ...localizedDisallow('/test-image-upload'),
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
