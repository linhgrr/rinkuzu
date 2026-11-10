'use client';

import type { ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';
import { getMarketingHeaderPosition } from '@/lib/routing/pathname';
import { MarketingHeader } from './MarketingHeader';

/**
 * Gives the marketing content pages (blog, pricing, about, FAQ, contact, legal)
 * the site header and their one `<main>` landmark, the skip link's target
 * (RIN-1519). The landing, auth and utility routes of the same layout render
 * exactly as before.
 */
export function MarketingContentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const position = pathname ? getMarketingHeaderPosition(pathname) : null;
  if (!position) return children;

  return (
    <>
      <MarketingHeader position={position} />
      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </>
  );
}
