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
});
