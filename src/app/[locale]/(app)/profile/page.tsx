'use client';

import { Suspense } from 'react';
import ProfileSettings from '@/features/profile/components/ProfileSettings';
import { ProfilePageFallback } from '@/features/profile/components/ProfilePageShell';

function ProfileContent() {
  return (
    <div className="min-h-screen bg-surface-page pb-24 md:pb-8">
      <main className="pt-6 md:pt-8 pb-4 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <ProfileSettings />
        </div>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfilePageFallback />}>
      <ProfileContent />
    </Suspense>
  );
}
