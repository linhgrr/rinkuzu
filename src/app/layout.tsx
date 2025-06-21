import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import PWAInstaller from '@/components/PWAInstaller';

const inter = Inter({ subsets: ['latin'] });
const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RinKuzu - Create Interactive Quizzes from PDFs',
  description: 'A modern platform for teachers to create interactive quizzes from PDF files with AI-powered question extraction and admin approval workflow.',
  keywords: 'quiz, education, PDF, AI, teachers, students, assessment, interactive learning',
  authors: [{ name: 'RinKuzu Team' }],
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: '#667eea',
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
    'msapplication-TileColor': '#667eea',
    'msapplication-config': '/browserconfig.xml',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#667eea" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RinKuzu" />
        <meta name="application-name" content="RinKuzu" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#667eea" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Prevent pull-to-refresh and overscroll */}
        <meta name="overscroll-behavior" content="none" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        
        {/* Mobile overscroll prevention script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Prevent pull-to-refresh and overscroll on mobile
                function preventOverscroll() {
                  // Prevent default touch behaviors that cause bouncing
                  document.addEventListener('touchstart', function(e) {
                    if (e.touches.length > 1) {
                      e.preventDefault();
                    }
                  }, { passive: false });
                  
                  document.addEventListener('touchmove', function(e) {
                    // Prevent pull-to-refresh
                    if (e.touches.length > 1) {
                      e.preventDefault();
                      return;
                    }
                    
                    var touch = e.touches[0];
                    var target = e.target;
                    
                    // Find scrollable parent
                    var scrollableParent = target;
                    while (scrollableParent && scrollableParent !== document.body) {
                      var style = window.getComputedStyle(scrollableParent);
                      if (style.overflow === 'scroll' || style.overflow === 'auto' || 
                          style.overflowY === 'scroll' || style.overflowY === 'auto') {
                        break;
                      }
                      scrollableParent = scrollableParent.parentElement;
                    }
                    
                    if (!scrollableParent || scrollableParent === document.body) {
                      // No scrollable parent found, prevent default
                      e.preventDefault();
                    }
                  }, { passive: false });
                  
                  // Additional iOS Safari fixes
                  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                    document.body.style.position = 'fixed';
                    document.body.style.width = '100%';
                    document.body.style.height = '100%';
                    document.body.style.overflow = 'hidden';
                    
                    // Allow main content to scroll
                    var main = document.querySelector('main');
                    if (main) {
                      main.style.height = '100vh';
                      main.style.overflowY = 'auto';
                      main.style.overscrollBehavior = 'none';
                      main.style.webkitOverflowScrolling = 'touch';
                    }
                  }
                }
                
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', preventOverscroll);
                } else {
                  preventOverscroll();
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} ${plusJakarta.variable} min-h-screen antialiased`}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
          <Providers>
            <main className="relative">
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
              
              {/* Content */}
              <div className="relative z-10">
                {children}
              </div>
            </main>
            <PWAInstaller />
          </Providers>
        </div>
      </body>
    </html>
  );
} 