import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Always show /vi/... and /en/... — simpler browser URLs, fewer bare-path edge cases.
  localePrefix: 'always',
  // Page metadata and sitemap.xml own hreflang. Disabling middleware-generated
  // Link headers prevents a conflicting unprefixed x-default URL.
  alternateLinks: false,
  // RIN-1679: no NEXT_LOCALE Set-Cookie, so a public page can be cached at the
  // edge. The path always carries the locale; bare `/` still follows Accept-Language.
  localeCookie: false,
});
