import type { Session } from 'next-auth';
import {
  HomeDashboard,
  type HomeDashboardAdaptiveSubject,
  type HomeDashboardQuiz,
  type HomeDashboardStats,
} from '@/features/dashboard/components/HomeDashboard';

interface DashboardPageShellProps {
  locale: string;
  userEmail: string;
  session: Session;
  stats: HomeDashboardStats;
  quizzes: HomeDashboardQuiz[];
  yourQuizzes: HomeDashboardQuiz[];
  adaptiveSubjects: HomeDashboardAdaptiveSubject[];
}

export async function DashboardPageShell({
  userEmail,
  session,
  stats,
  quizzes,
  yourQuizzes,
  adaptiveSubjects,
}: DashboardPageShellProps) {
  const userName = session.user?.displayName || userEmail?.split('@')[0] || 'User';

  return (
    <HomeDashboard
      stats={stats}
      quizzes={quizzes}
      yourQuizzes={yourQuizzes}
      adaptiveSubjects={adaptiveSubjects}
      userName={userName}
    />
  );
}
