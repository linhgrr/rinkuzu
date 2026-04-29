'use client';

import { usePathname } from 'next/navigation';
import React from 'react';
import { isAdaptiveExerciseModePath } from '@/lib/routing/pathname';

export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isExerciseMode = isAdaptiveExerciseModePath(pathname || '/');
  const mobileBottomNavPadding = 'pb-[calc(88px+env(safe-area-inset-bottom,8px))]';

  return (
    <main
      className={`relative min-h-screen ${isExerciseMode ? '' : `${mobileBottomNavPadding} md:pb-0`}`}
    >
      {children}
    </main>
  );
}
