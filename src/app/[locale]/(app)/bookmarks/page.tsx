'use client';

import { Suspense, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import ProfileBookmarks from '@/features/profile/components/ProfileBookmarks';

function BookmarksContent() {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 md:pb-8">
      <Navigation />

      <div className="hidden md:block">
        <Sidebar isOpen={isSidebarOpen} onToggle={handleSidebarToggle} currentPath={pathname} />
      </div>

      <main
        className={`pt-6 md:pt-8 pb-4 px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
          isSidebarOpen ? 'md:ml-64' : 'md:ml-16'
        }`}
      >
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 md:p-6 min-h-[400px] md:min-h-[500px]">
            <ProfileBookmarks />
          </div>
        </div>
      </main>
    </div>
  );
}

function BookmarksFallback() {
  const tCommon = useTranslations('common');

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center animate-pulse">
        <div className="w-12 h-12 bg-neutral-200 rounded-xl mx-auto mb-4" />
        <p className="text-[var(--text-muted)]">{tCommon('loading')}</p>
      </div>
    </div>
  );
}

export default function BookmarksPage() {
  return (
    <Suspense fallback={<BookmarksFallback />}>
      <BookmarksContent />
    </Suspense>
  );
}
