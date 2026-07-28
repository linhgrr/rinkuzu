import type { Metadata } from 'next';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { publicEnv } from '@/lib/public-env';

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export const siteUrl = new URL(trimTrailingSlash(publicEnv.NEXT_PUBLIC_SITE_URL));

function normalizeSeoPath(path: string): string {
  if (!path || path.trim() === '') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

/** Browser path under localePrefix: 'always' (e.g. /vi, /en/about). */
function localizedPath(locale: string, path: string): string {
  const safePath = normalizeSeoPath(path);
  return safePath === '/' ? `/${locale}` : `/${locale}${safePath}`;
}

export function canonicalFor(locale: string, path: string): string {
  const normalized = localizedPath(locale, path);
  return `${siteUrl.origin}${normalized}`;
}

function languageAlternates(path: string): Record<string, string> {
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
  imagePath,
  robots,
}: LocalizedMetadataInput): Metadata {
  const canonical = canonicalFor(locale, path);
  // Default to the dynamic 1200x630 OG endpoint so social previews render at the
  // correct aspect ratio. Square icons (icon-512x512.png) get letterboxed/cropped.
  const resolvedImagePath = imagePath ?? `/og?title=${encodeURIComponent(title)}`;
  const imageUrl = new URL(resolvedImagePath, siteUrl).toString();

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
