'use client';

import { usePathname } from '@/i18n/navigation';
import React from 'react';
import { isAdaptiveExerciseModePath } from '@/lib/routing/pathname';

export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isExerciseMode = isAdaptiveExerciseModePath(pathname || '/');
  // The reservation lives in one CSS class beside the geometry the banners are
  // positioned from, so content and overlay cannot drift apart. It resolves to
  // the bottom navigation alone until a transient prompt announces itself.
  return (
    <main className={`relative min-h-screen ${isExerciseMode ? '' : 'app-bottom-inset'}`}>
      {children}
    </main>
  );
}
