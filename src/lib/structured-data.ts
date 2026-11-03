import { canonicalFor, siteUrl } from '@/lib/seo';
import type { Locale } from '@/i18n/config';

type FaqItem = {
  q: string;
  a: string;
};

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RinKuzu',
    url: siteUrl.origin,
    logo: `${siteUrl.origin}/icons/icon-512x512.png`,
    description:
      "RinKuzu is an AI-powered personalized learning platform that transforms PDF documents into quiz-based learning journeys using knowledge graphs and Bloom's Taxonomy.",
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@rinkuzu.app',
      contactType: 'customer support',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Room 302, Building A1, 17 Dai Co Viet Street',
      addressLocality: 'Hai Ba Trung District',
      addressRegion: 'Hanoi',
      postalCode: '100000',
      addressCountry: 'VN',
    },
    // Only verified, Rinkuzu-owned profiles belong here.
    sameAs: ['https://www.threads.com/@rinkuzu_app'],
  };
}

export function buildWebsiteSchema(locale: Locale | string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'RinKuzu',
    url: canonicalFor(locale, '/'),
    // Use locale-specific URL for the canonical WebSite entry
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl.origin}/explore?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildWebPageSchema(locale: Locale | string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'AI Quiz Generator from PDF - Knowledge Graph | RinKuzu',
    url: canonicalFor(locale, '/'),
    description:
      'Generate quizzes from PDFs with AI, build knowledge graph learning paths, and run personalized practice sessions for students, teachers, and teams.',
    inLanguage: locale,
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: `${siteUrl.origin}/icons/icon-512x512.png`,
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

export function buildSoftwareApplicationSchema(locale: Locale | string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'RinKuzu Personalized Learning',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: canonicalFor(locale, '/adaptive'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/IsAccessibleForFree',
      url: canonicalFor(locale, '/pricing'),
    },
    description:
      'Learning platform that uses AI to build personalized learning paths from PDF materials.',
  };
}
