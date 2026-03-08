'use client';

import { usePathname } from 'next/navigation';
import React from 'react';

export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isExerciseMode = pathname?.includes('/adaptive-learning/exercise') || pathname?.includes('/adaptive-learning/result');

    return (
        <main className={`relative min-h-screen ${isExerciseMode ? '' : 'pb-16 md:pb-0'}`}>
            {children}
        </main>
    );
}
