import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import '../globals.css';
import { routing } from '@/i18n/routing';
import { canonicalFor, languageAlternates, siteUrl } from '@/lib/seo';
import { defaultLocale } from '@/i18n/config';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
  buildWebsiteSchema,
} from '@/lib/structured-data';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
  alternates: {
    canonical: canonicalFor(defaultLocale, '/'),
    languages: languageAlternates('/'),
  },
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
  const messages = await getMessages();

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
        {/* Preconnect for third-party origins used by GTM and analytics */}
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google-analytics.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} min-h-screen antialiased bg-neutral-50`}>
        <NextIntlClientProvider messages={messages}>
          <JsonLd id="org-schema" data={organizationSchema} />
          <JsonLd id="website-schema" data={websiteSchema} />
          <JsonLd id="webpage-schema" data={webpageSchema} />
          <JsonLd id="software-app-schema" data={softwareApplicationSchema} />
          {children}
        </NextIntlClientProvider>
        {process.env['NEXT_PUBLIC_GA_ID'] ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env['NEXT_PUBLIC_GA_ID']}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env['NEXT_PUBLIC_GA_ID']}');
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
