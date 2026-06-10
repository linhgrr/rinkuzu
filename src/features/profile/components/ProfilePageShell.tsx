'use client';

import { Suspense, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

function ProfilePageFallback() {
  const tCommon = useTranslations('common');

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page">
      <div className="text-center animate-pulse">
        <div className="size-12 bg-surface-warm rounded-xl mx-auto mb-4" />
        <p className="text-ink-muted">{tCommon('loading')}</p>
      </div>
    </div>
  );
}

/**
 * Shared page shell for the profile list routes (My Quizzes / History /
 * Bookmarks). Wraps the feature panel in the standard surface card and a
 * Suspense fallback so the three routes stay visually in sync.
 */
export function ProfilePageShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ProfilePageFallback />}>
      <div className="min-h-screen bg-surface-page pb-24 md:pb-8">
        <main className="pt-6 md:pt-8 pb-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="bg-surface rounded-2xl shadow-sm border border-line p-4 md:p-6 min-h-[400px] md:min-h-[500px]">
              {children}
            </div>
          </div>
        </main>
      </div>
    </Suspense>
  );
}
