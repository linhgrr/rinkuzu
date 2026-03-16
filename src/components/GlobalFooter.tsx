'use client';

import { usePathname } from 'next/navigation';
import { Footer } from '@/app/[locale]/_components/guest-landing/Footer';
import { shouldHideGlobalFooter } from '@/lib/routing/pathname';

export function GlobalFooter() {
  const pathname = usePathname();

  if (!pathname) return null;

  const isNoFooter = shouldHideGlobalFooter(pathname);

  if (isNoFooter) {
    return null;
  }

  return <Footer />;
}
