export interface DashboardLearningCardViewModel {
  id: string;
  title: string;
  category: string;
  progress: number;
  href: string;
  tone: 'warm' | 'cool';
  isAi: boolean;
  timeLabel: string;
}

export interface DashboardWeekDayViewModel {
  label: string;
  active: boolean;
}

export interface DashboardProgressViewModel {
  streak: number;
  accuracyPercent: number;
  studyHours: number;
  dueCount: number;
  weekDays: DashboardWeekDayViewModel[];
}

export interface DashboardContinueLearningViewModel {
  items: DashboardLearningCardViewModel[];
  viewAllHref: string;
}

export interface DashboardViewModel {
  userName: string;
  locale: string;
  progress: DashboardProgressViewModel;
  continueLearning: DashboardContinueLearningViewModel;
  recentOwnedQuizzes: QuizListItemViewModel[];
  recentPublicQuizzes: QuizListItemViewModel[];
}

export interface DashboardHomeCopy {
  welcomeTitle: string;
  welcomeSubtitle: string;
  viewAll: string;
  hero: {
    title: string;
    description: string;
    cta: string;
  };
  quizBuilder: {
    title: string;
    subtitle: string;
  };
  continueLearning: {
    title: string;
    subtitle: string;
    emptyAction: string;
  };
  reviewToday: {
    title: string;
    due: string;
    caughtUp: string;
    reviewAction: string;
    exploreAction: string;
  };
  recentOwnedQuizzes: {
    title: string;
    subtitle: string;
    emptyAction: string;
  };
  recentPublicQuizzes: {
    title: string;
    subtitle: string;
    emptyAction: string;
  };
  learningProgress: {
    title: string;
    subtitle: string;
    dayStreak: string;
    accuracy: string;
    studyTime: string;
  };
}
import type { QuizListItemViewModel } from '@/features/quiz/types/quiz-list-view-model';
