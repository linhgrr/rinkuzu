// Supported locales
export const locales = ['vi', 'en'] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = 'vi';

// Locale labels for UI
export const localeLabels: Record<Locale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

// Locale flags for UI
export const localeFlags: Record<Locale, string> = {
  vi: 'VI',
  en: 'EN',
};
