'use client';

import PWAInstaller from '@/components/PWAInstaller';
import PWAZoomGuard from '@/components/PWAZoomGuard';
import FloatingDraftProgress from '@/components/FloatingDraftProgressIsland';

export function ClientOnlyAppAddons() {
  return (
    <>
      <FloatingDraftProgress />
      <PWAInstaller />
      <PWAZoomGuard />
    </>
  );
}
