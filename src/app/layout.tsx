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
        
        {/* iOS Safari scrolling fixes */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // iOS Safari specific scrolling fixes
                function initIOSScrollFix() {
                  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                    // Enable smooth scrolling on iOS
                    document.documentElement.style.webkitOverflowScrolling = 'touch';
                    document.body.style.webkitOverflowScrolling = 'touch';
                    
                    // Prevent zoom on double tap
                    var lastTouchEnd = 0;
                    document.addEventListener('touchend', function (event) {
                      var now = (new Date()).getTime();
                      if (now - lastTouchEnd <= 300) {
                        event.preventDefault();
                      }
                      lastTouchEnd = now;
                    }, false);
                    
                    // Prevent rubber band scrolling
                    document.addEventListener('touchmove', function(e) {
                      // Allow scrolling inside elements with overflow auto/scroll
                      var el = e.target;
                      while (el && el !== document.body) {
                        var style = window.getComputedStyle(el);
                        if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
                            style.overflow === 'auto' || style.overflow === 'scroll') {
                          return;
                        }
                        el = el.parentElement;
                      }
                      
                      // Check if we're at the top or bottom of the page
                      var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
                      var scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                      var clientHeight = document.documentElement.clientHeight || window.innerHeight;
                      
                      if (scrollTop === 0 && e.touches[0].clientY > e.touches[0].clientY) {
                        // At top, trying to scroll up
                        e.preventDefault();
                      } else if (scrollTop + clientHeight >= scrollHeight && e.touches[0].clientY < e.touches[0].clientY) {
                        // At bottom, trying to scroll down
                        e.preventDefault();
                      }
                    }, { passive: false });
                  }
                }
                
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', initIOSScrollFix);
                } else {
                  initIOSScrollFix();
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