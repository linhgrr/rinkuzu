'use client';

import PWAInstaller from '@/components/PWAInstaller';
import PWAZoomGuard from '@/components/PWAZoomGuard';

export function ClientOnlyMarketingAddons() {
  return (
    <>
      <PWAInstaller />
      <PWAZoomGuard />
    </>
  );
}
