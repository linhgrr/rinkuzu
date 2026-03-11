import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import dynamic from 'next/dynamic';
import { Inter } from 'next/font/google';
import '../globals.css';
import './_components/new-landing/style.css';
import Providers from '../providers';
import BottomNav from '@/components/BottomNav';
import { routing } from '@/i18n/routing';
import { defaultLocale } from '@/i18n/config';
import { MainLayoutWrapper } from '@/components/MainLayoutWrapper';
import { GlobalFooter } from '@/components/GlobalFooter';
import { languageAlternates, siteUrl } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

/**
 * Rule: bundle-defer-third-party
 * Defer loading of non-critical components after hydration
 * PWAInstaller and FloatingDraftProgress are not needed for initial render
 */
const PWAInstaller = dynamic(() => import('@/components/PWAInstaller'), {
  ssr: false,
});

const FloatingDraftProgress = dynamic(
  () => import('@/components/FloatingDraftProgress').then(mod => ({ default: mod.FloatingDraftProgress })),
  { ssr: false }
);


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'RinKuzu - Create Interactive Quizzes from PDFs',
  description: 'A modern platform for teachers to create interactive quizzes from PDF files with AI-powered question extraction and admin approval workflow.',
  keywords: 'quiz, education, PDF, AI, teachers, students, assessment, interactive learning',
  authors: [{ name: 'RinKuzu Team' }],
  alternates: {
    canonical: '/',
    languages: languageAlternates('/'),
  },
  openGraph: {
    type: 'website',
    siteName: 'RinKuzu',
    title: 'RinKuzu - Create Interactive Quizzes from PDFs',
    description: 'A modern platform for teachers to create interactive quizzes from PDF files with AI-powered question extraction and admin approval workflow.',
    url: '/',
    images: [
      {
        url: '/icons/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'RinKuzu',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RinKuzu - Create Interactive Quizzes from PDFs',
    description: 'A modern platform for teachers to create interactive quizzes from PDF files with AI-powered question extraction and admin approval workflow.',
    images: ['/icons/icon-512x512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      maxSnippet: -1,
      maxImagePreview: 'large',
      maxVideoPreview: -1,
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
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  const messages = await getMessages();

  const currentLocalePath = locale === defaultLocale ? '/' : `/${locale}`;

  return (
    <html lang={locale} className="scroll-smooth">
      <head>
        <link rel="canonical" href={currentLocalePath} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
      <body className={`${inter.className} min-h-screen antialiased bg-[#f5f5f7]`}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <MainLayoutWrapper>
              {children}
            </MainLayoutWrapper>
            <GlobalFooter />
            <BottomNav />
            <FloatingDraftProgress />
            <PWAInstaller />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
