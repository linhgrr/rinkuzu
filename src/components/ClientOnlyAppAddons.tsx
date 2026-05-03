'use client';

import PWAInstaller from '@/components/PWAInstaller';
import FloatingDraftProgress from '@/components/FloatingDraftProgressIsland';

export function ClientOnlyAppAddons() {
  return (
    <>
      <FloatingDraftProgress />
      <PWAInstaller />
    </>
  );
}
