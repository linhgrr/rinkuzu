import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat, Unbounded, Vina_Sans } from 'next/font/google';
import '../globals.css';
import { routing } from '@/i18n/routing';
import { siteUrl } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
  buildWebsiteSchema,
} from '@/lib/structured-data';
import { NextIntlClientProvider } from 'next-intl';
import { SerwistProvider } from '@serwist/turbopack/react';
import { AnalyticsRoot } from '@/components/analytics/AnalyticsRoot';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'optional',
  variable: '--font-inter',
});

const montserrat = Montserrat({
  subsets: ['latin', 'vietnamese'],
  display: 'optional',
  variable: '--font-montserrat',
  weight: ['400', '600', '700'],
});

const unbounded = Unbounded({
  subsets: ['latin'],
  display: 'optional',
  variable: '--font-unbounded',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const vinaSans = Vina_Sans({
  subsets: ['latin'],
  display: 'optional',
  variable: '--font-vina-sans',
  weight: ['400'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'AI Quiz Generator from PDF - Knowledge Graph | RinKuzu',
  description:
    'Generate quizzes from PDFs with AI, build knowledge graph learning paths, and run adaptive practice sessions for students, teachers, and teams.',
  keywords: 'quiz, education, PDF, AI, teachers, students, assessment, interactive learning',
  authors: [{ name: 'RinKuzu Team' }],
  openGraph: {
    type: 'website',
    siteName: 'RinKuzu',
    title: 'AI Quiz Generator from PDF - Knowledge Graph | RinKuzu',
    description:
      'Generate quizzes from PDFs with AI, build knowledge graph learning paths, and run adaptive practice sessions for students, teachers, and teams.',
    url: '/',
    images: [
      {
        url: '/og',
        width: 1200,
        height: 630,
        alt: 'RinKuzu - AI Quiz Generator from PDF',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Quiz Generator from PDF - Adaptive learning | RinKuzu',
    description:
      'Generate quizzes from PDFs with AI, build knowledge graph learning paths, and run adaptive practice sessions for students, teachers, and teams.',
    images: ['/images/navbar_logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RinKuzu',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'RinKuzu',
    'application-name': 'RinKuzu',
    'msapplication-TileColor': '#0071e3',
    'msapplication-config': '/browserconfig.xml',
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.some((supportedLocale) => supportedLocale === locale)) {
    notFound();
  }

  const organizationSchema = buildOrganizationSchema();
  const websiteSchema = buildWebsiteSchema(locale);
  const webpageSchema = buildWebPageSchema(locale);
  const softwareApplicationSchema = buildSoftwareApplicationSchema(locale);

  return (
    <html lang={locale} className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RinKuzu" />
        <meta name="application-name" content="RinKuzu" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0071e3" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="overscroll-behavior" content="none" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body
        className={`${inter.className} ${montserrat.variable} ${unbounded.variable} ${vinaSans.variable} min-h-screen bg-neutral-50 antialiased`}
      >
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV !== 'production'}
          cacheOnNavigation={false}
          reloadOnOnline={false}
        >
          <NextIntlClientProvider messages={null}>
            <JsonLd id="org-schema" data={organizationSchema} />
            <JsonLd id="website-schema" data={websiteSchema} />
            <JsonLd id="webpage-schema" data={webpageSchema} />
            <JsonLd id="software-app-schema" data={softwareApplicationSchema} />
            {children}
            <AnalyticsRoot />
          </NextIntlClientProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
