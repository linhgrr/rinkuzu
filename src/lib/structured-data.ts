import { canonicalFor, siteUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/config';

type FaqItem = {
  q: string;
  a: string;
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RinKuzu',
    url: siteUrl.origin,
    logo: `${siteUrl.origin}/icons/icon-512x512.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@rinkuzu.com',
      contactType: 'customer support',
    },
  };
}

export function buildWebsiteSchema(locale: Locale | string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'RinKuzu',
    url: canonicalFor(locale, '/'),
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl.origin}/explore?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildFaqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

export function buildBreadcrumbSchema(locale: Locale | string, items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonicalFor(locale, item.path),
    })),
  };
}

export function buildSoftwareApplicationSchema(locale: Locale | string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'RinKuzu Adaptive Learning',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: canonicalFor(locale, '/adaptive-learning'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Adaptive learning platform using AI to build personalized learning paths from PDF materials.',
  };
}
