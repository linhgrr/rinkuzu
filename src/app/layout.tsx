import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import PWAInstaller from '@/components/PWAInstaller';
import BottomNav from '@/components/BottomNav';

const inter = Inter({
  subsets: ['latin'],
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
  title: 'RinKuzu - Create Interactive Quizzes from PDFs',
  description: 'A modern platform for teachers to create interactive quizzes from PDF files with AI-powered question extraction and admin approval workflow.',
  keywords: 'quiz, education, PDF, AI, teachers, students, assessment, interactive learning',
  authors: [{ name: 'RinKuzu Team' }],
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
      <head>
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
        <Providers>
          <main className="relative min-h-screen pb-16 md:pb-0">
            {children}
          </main>
          <BottomNav />
          <PWAInstaller />
        </Providers>
      </body>
    </html>
  );
}
