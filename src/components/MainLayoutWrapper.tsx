'use client';

import { usePathname } from 'next/navigation';
import React from 'react';
import { isAdaptiveExerciseModePath } from '@/lib/routing/pathname';

export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isExerciseMode = isAdaptiveExerciseModePath(pathname || '/');

  return (
    <main className={`relative min-h-screen ${isExerciseMode ? '' : 'pb-16 md:pb-0'}`}>
      {children}
    </main>
  );
}
