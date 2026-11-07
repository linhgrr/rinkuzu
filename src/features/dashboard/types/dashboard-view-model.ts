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

interface DashboardWeekDayViewModel {
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

interface DashboardContinueLearningViewModel {
  items: DashboardLearningCardViewModel[];
  viewAllHref: string;
}

export interface DashboardStarterQuizViewModel {
  slug: string;
  title: string;
  questionCount: number;
  href: string;
}

export interface DashboardStarterViewModel {
  primary: DashboardStarterQuizViewModel;
  alternatives: DashboardStarterQuizViewModel[];
}

export interface DashboardViewModel {
  userName: string;
  locale: string;
  progress: DashboardProgressViewModel;
  continueLearning: DashboardContinueLearningViewModel;
  recentOwnedQuizzes: QuizListItemViewModel[];
  recentPublicQuizzes: QuizListItemViewModel[];
  /** Set only for a new learner with at least one resolved starter quiz. */
  starter: DashboardStarterViewModel | null;
  heroCtaHref: string;
}

export interface DashboardHomeCopy {
  welcomeTitle: string;
  welcomeSubtitle: string;
  viewAll: string;
  hero: {
    title: string;
    description: string;
    cta: string;
    adaptiveLink: string;
  };
  starter: {
    title: string;
    subtitle: string;
    start: string;
    alternativesLabel: string;
    questionCount: (count: number) => string;
  };
  quizBuilder: {
    title: string;
    subtitle: string;
  };
  continueLearning: {
    title: string;
    subtitle: string;
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
