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

/**
 * hreflang map for `path` across `pageLocales` (every locale by default), plus
 * `x-default` when the default locale is one of them (RIN-1312).
 */
export function languageAlternates(
  path: string,
  pageLocales: readonly string[] = locales,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const locale of locales) {
    if (pageLocales.includes(locale)) map[locale] = canonicalFor(locale, path);
  }
  if (pageLocales.includes(defaultLocale)) {
    map['x-default'] = canonicalFor(defaultLocale, path);
  }
  return map;
}

function defaultOgImagePath(title: string, extra: LocalizedMetadataInput['ogImageParams']): string {
  const extraQuery = Object.entries(extra ?? {})
    .map(([key, value]) => `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('');
  return `/og?title=${encodeURIComponent(title)}${extraQuery}`;
}

type LocalizedMetadataInput = {
  locale: Locale | string;
  path: string;
  title: string;
  description: string;
  imagePath?: string;
  /** Extra `/og` query params after the title (e.g. a quiz's question count, RIN-1180). */
  ogImageParams?: Readonly<Record<string, string>>;
  robots?: Metadata['robots'];
  /** Locale of the canonical URL when it differs from the page locale (RIN-1241). */
  canonicalLocale?: Locale | string;
  /** False for one-language pages (quizzes): no hreflang pair (RIN-1241 D14). */
  languageAlternates?: boolean;
  /** Title on the `/og` card when it differs from the `<title>` (RIN-1241). */
  ogImageTitle?: string;
  /** Locales the page exists in, when not all of them (vi-only blog posts, RIN-1312). */
  alternateLocales?: readonly string[];
};

export function buildLocalizedMetadata({
  locale,
  path,
  title,
  description,
  imagePath,
  ogImageParams,
  robots,
  canonicalLocale,
  languageAlternates: withLanguageAlternates = true,
  ogImageTitle,
  alternateLocales,
}: LocalizedMetadataInput): Metadata {
  const canonical = canonicalFor(canonicalLocale ?? locale, path);
  // Default to the dynamic 1200x630 OG endpoint so social previews render at the
  // correct aspect ratio. Square icons (icon-512x512.png) get letterboxed/cropped.
  const resolvedImagePath = imagePath ?? defaultOgImagePath(ogImageTitle ?? title, ogImageParams);
  const imageUrl = new URL(resolvedImagePath, siteUrl).toString();

  return {
    title,
    description,
    alternates: {
      canonical,
      ...(withLanguageAlternates ? { languages: languageAlternates(path, alternateLocales) } : {}),
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
