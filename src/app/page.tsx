'use client';

import { useSession } from 'next-auth/react';
import { GuestLanding, DashboardClient } from './_components';
import { useQuizzes } from '@/hooks';

export default function HomePage() {
  const { data: session, status } = useSession();
  const { quizzes, isLoading } = useQuizzes(6);

  // Loading state
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="text-center animate-pulse">
          <div className="w-12 h-12 bg-gray-200 rounded-xl mx-auto mb-4" />
          <p className="text-[#86868b]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Guest view
  if (!session) {
    return <GuestLanding quizzes={quizzes} />;
  }

  // Authenticated view
  return <DashboardClient userEmail={session.user?.email || ''} />;
}
