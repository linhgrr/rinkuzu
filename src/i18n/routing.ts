import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Always show /vi/... and /en/... — simpler browser URLs, fewer bare-path edge cases.
  localePrefix: 'always',
});
