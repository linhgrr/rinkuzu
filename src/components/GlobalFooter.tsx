'use client';

import { usePathname } from 'next/navigation';
import { shouldHideGlobalFooter } from '@/lib/routing/pathname';
import { Footer as FooterSection } from '@/features/landing/components/new-landing/Footer';

export function GlobalFooter() {
  const pathname = usePathname();
  if (!pathname) return null;
  if (shouldHideGlobalFooter(pathname)) return null;
  return (
    <div className="hidden md:block">
      <FooterSection />
    </div>
  );
}
