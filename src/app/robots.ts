import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/config';
import { siteUrl } from '@/lib/seo';
import { PRIVATE_ROUTE_PREFIXES } from '@/lib/seo.routes';

function localizedDisallow(path: string): string[] {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return locales.map((locale) =>
    locale === defaultLocale ? normalized : `/${locale}${normalized}`,
  );
}

export default function robots(): MetadataRoute.Robots {
  const disallow = [...PRIVATE_ROUTE_PREFIXES.flatMap((path) => localizedDisallow(path)), '/api/'];

  return {
    rules: [
      // AI / LLM crawlers — explicit welcome
      { userAgent: 'GPTBot', allow: '/', disallow: [] },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: [] },
      { userAgent: 'ClaudeBot', allow: '/', disallow: [] },
      { userAgent: 'Claude-WebBot', allow: '/', disallow: [] },
      { userAgent: 'Google-Extended', allow: '/', disallow: [] },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: [] },
      { userAgent: 'PerplexityBot', allow: '/', disallow: [] },
      { userAgent: 'Diffbot', allow: '/', disallow: [] },
      { userAgent: 'Bytespider', allow: '/', disallow: [] },
      { userAgent: 'Applebot-Extended', allow: '/', disallow: [] },
      // Default — allow public, block private
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${siteUrl.origin}/sitemap.xml`,
    host: siteUrl.host,
  };
}
