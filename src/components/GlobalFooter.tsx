'use client';

import { usePathname } from 'next/navigation';
import { Footer } from '@/app/[locale]/_components/guest-landing/Footer';

export function GlobalFooter() {
  const pathname = usePathname();

  if (!pathname) return null;

  // Paths where the massive marketing footer should NOT be displayed
  const noFooterPatterns = [
    '/adaptive-learning/exercise',
    '/adaptive-learning/result',
    '/adaptive-learning/processing',
    '/quiz/',
    '/create',
    '/edit/',
    '/admin',
    '/login',
    '/register',
    '/setup',
    '/history',
    '/profile'
  ];

  const isNoFooter = noFooterPatterns.some(pattern => pathname.includes(pattern));

  if (isNoFooter) {
    return null;
  }

  return <Footer />;
}
