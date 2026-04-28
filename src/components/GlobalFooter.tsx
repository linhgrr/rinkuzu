'use client';

import { usePathname } from 'next/navigation';
import { shouldHideGlobalFooter } from '@/lib/routing/pathname';
import { FooterSection } from '@/features/landing/components/new-landing';

export function GlobalFooter() {
  const pathname = usePathname();
  if (!pathname) return null;
  if (shouldHideGlobalFooter(pathname)) return null;
  return <FooterSection />;
}
