import type { Metadata } from 'next';
import { defaultLocale, locales, type Locale } from '@/i18n/config';

const FALLBACK_SITE_URL = 'https://quizz-ck.vercel.app';

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export const siteUrl = new URL(
  trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || FALLBACK_SITE_URL)
);

export function normalizeSeoPath(path: string): string {
  if (!path || path.trim() === '') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function localePrefix(locale: string): string {
  return locale === defaultLocale ? '' : `/${locale}`;
}

export function localizedPath(locale: string, path: string): string {
  const safePath = normalizeSeoPath(path);
  return `${localePrefix(locale)}${safePath === '/' ? '' : safePath}` || '/';
}

export function canonicalFor(locale: string, path: string): string {
  const normalized = localizedPath(locale, path);
  return `${siteUrl.origin}${normalized}`;
}

export function languageAlternates(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const locale of locales) {
    map[locale] = canonicalFor(locale, path);
  }
  map['x-default'] = canonicalFor(defaultLocale, path);
  return map;
}

type LocalizedMetadataInput = {
  locale: Locale | string;
  path: string;
  title: string;
  description: string;
  imagePath?: string;
  robots?: Metadata['robots'];
};

export function buildLocalizedMetadata({
  locale,
  path,
  title,
  description,
  imagePath = '/icons/icon-512x512.png',
  robots,
}: LocalizedMetadataInput): Metadata {
  const canonical = canonicalFor(locale, path);
  const imageUrl = new URL(imagePath, siteUrl).toString();

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(path),
    },
    openGraph: {
      type: 'website',
      locale,
      url: canonical,
      title,
      description,
      siteName: 'RinKuzu',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    robots,
  };
}
