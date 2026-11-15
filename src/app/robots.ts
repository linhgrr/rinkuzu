import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { siteUrl } from '@/lib/seo';
import { NON_INDEXABLE_CRAWL_PREFIXES, PRIVATE_ROUTE_PREFIXES } from '@/lib/seo.routes';

function localizedDisallow(path: string): string[] {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return locales.map((locale) => (normalized === '/' ? `/${locale}` : `/${locale}${normalized}`));
}

// AI / LLM crawlers: explicitly welcome on public pages.
const NAMED_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-WebBot',
  'Google-Extended',
  'OAI-SearchBot',
  'PerplexityBot',
  'Diffbot',
  'Bytespider',
  'Applebot-Extended',
] as const;

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    ...[...PRIVATE_ROUTE_PREFIXES, ...NON_INDEXABLE_CRAWL_PREFIXES].flatMap((path) =>
      localizedDisallow(path),
    ),
    '/api/',
  ];

  return {
    rules: [
      // A crawler that matches its own group ignores `*`, so every named
      // group carries the same disallow list (RIN-1644).
      ...NAMED_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow })),
      // Default: allow public, block private and pages with nothing to index.
      { userAgent: '*', allow: '/', disallow },
    ],
    sitemap: `${siteUrl.origin}/sitemap.xml`,
    host: siteUrl.host,
  };
}
