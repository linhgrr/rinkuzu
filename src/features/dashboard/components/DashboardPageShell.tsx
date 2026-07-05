import type { Session } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import {
  toDashboardViewModel,
  type ToDashboardViewModelInput,
} from '@/features/dashboard/mappers/dashboard-view-model.mapper';
import { HomeDashboard } from '@/features/dashboard/components/HomeDashboard';
import type { DashboardHomeCopy } from '@/features/dashboard/types/dashboard-view-model';

interface DashboardPageShellProps {
  locale: string;
  userEmail: string;
  session: Session;
  stats: ToDashboardViewModelInput['stats'];
  adaptiveSubjects: ToDashboardViewModelInput['adaptiveSubjects'];
  inProgressQuizzes: ToDashboardViewModelInput['inProgressQuizzes'];
  recentOwnedQuizzes: ToDashboardViewModelInput['recentOwnedQuizzes'];
  recentPublicQuizzes: ToDashboardViewModelInput['recentPublicQuizzes'];
}

export async function DashboardPageShell({
  locale,
  userEmail,
  session,
  stats,
  adaptiveSubjects,
  inProgressQuizzes,
  recentOwnedQuizzes,
  recentPublicQuizzes,
}: DashboardPageShellProps) {
  const t = await getTranslations('dashboard.home');
  const userName = session.user?.displayName ?? userEmail?.split('@')[0] ?? 'User';
  const viewModel = toDashboardViewModel({
    userName,
    stats,
    adaptiveSubjects,
    inProgressQuizzes,
    recentOwnedQuizzes,
    recentPublicQuizzes,
    locale,
    copy: {
      aiLearning: t('learningCard.aiLearning'),
      inProgress: t('learningCard.inProgress'),
      quizBuilderTitle: t('quizBuilder.title'),
      recentlyUpdated: t('time.recentlyUpdated'),
      today: t('time.today'),
      dayAgo: (count) => t('time.dayAgo', { count }),
      daysAgo: (count) => t('time.daysAgo', { count }),
      weekdayLabels: [
        t('weekdays.sun'),
        t('weekdays.mon'),
        t('weekdays.tue'),
        t('weekdays.wed'),
        t('weekdays.thu'),
        t('weekdays.fri'),
        t('weekdays.sat'),
      ],
    },
  });
  const copy: DashboardHomeCopy = {
    welcomeTitle: t('welcomeBack', { name: userName }),
    welcomeSubtitle: t('welcomeSubtitle'),
    viewAll: t('viewAll'),
    hero: {
      title: t('hero.title'),
      description: t('hero.description'),
      cta: t('hero.cta'),
    },
    quizBuilder: {
      title: t('quizBuilder.title'),
      subtitle: t('quizBuilder.subtitle'),
    },
    continueLearning: {
      title: t('continueLearning.title'),
      subtitle: t('continueLearning.subtitle'),
      emptyAction: t('continueLearning.emptyAction'),
    },
    reviewToday: {
      title: t('reviewToday.title'),
      due: t('reviewToday.due', { count: viewModel.progress.dueCount }),
      caughtUp: t('reviewToday.caughtUp'),
      reviewAction: t('reviewToday.reviewAction'),
      exploreAction: t('reviewToday.exploreAction'),
    },
    recentOwnedQuizzes: {
      title: t('recentOwnedQuizzes.title'),
      subtitle: t('recentOwnedQuizzes.subtitle'),
      emptyAction: t('recentOwnedQuizzes.emptyAction'),
    },
    recentPublicQuizzes: {
      title: t('recentPublicQuizzes.title'),
      subtitle: t('recentPublicQuizzes.subtitle'),
      emptyAction: t('recentPublicQuizzes.emptyAction'),
    },
    learningProgress: {
      title: t('learningProgress.title'),
      subtitle: t('learningProgress.subtitle'),
      dayStreak: t('learningProgress.dayStreak'),
      accuracy: t('learningProgress.accuracy'),
      studyTime: t('learningProgress.studyTime'),
    },
  };

  return <HomeDashboard viewModel={viewModel} copy={copy} />;
}
