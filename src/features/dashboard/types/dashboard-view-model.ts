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
  weekDays: DashboardWeekDayViewModel[];
}

export interface DashboardContinueLearningViewModel {
  items: DashboardLearningCardViewModel[];
  viewAllHref: string;
}

export interface DashboardViewModel {
  userName: string;
  progress: DashboardProgressViewModel;
  continueLearning: DashboardContinueLearningViewModel;
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
  learningProgress: {
    title: string;
    subtitle: string;
    dayStreak: string;
    accuracy: string;
    studyTime: string;
  };
}
