import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { getLocaleMessages } from './messages';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.some((supportedLocale) => supportedLocale === locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: await getLocaleMessages(locale),
  };
});
