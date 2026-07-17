import type {
  DashboardBootstrapDto,
  DashboardInProgressQuizDto,
  DashboardStatsDto,
} from '@/dtos/dashboard';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { ROUTES } from '@/shared/constants/routes';
import { formatDate } from '@/lib/formatters';
import { requireFirstNonEmptyString } from '@/lib/non-empty-string';
import type { DashboardViewModel } from '@/features/dashboard/types/dashboard-view-model';
import { toQuizListItemViewModel } from '@/features/quiz/mappers/quiz-list.mapper';

interface DashboardViewModelCopy {
  aiLearning: string;
  inProgress: string;
  quizBuilderTitle: string;
  recentlyUpdated: string;
  today: string;
  dayAgo: (count: number) => string;
  daysAgo: (count: number) => string;
  weekdayLabels: string[];
}

export interface ToDashboardViewModelInput {
  userName: string;
  stats: DashboardBootstrapDto['stats'];
  adaptiveSubjects: DashboardBootstrapDto['adaptiveSubjects'];
  inProgressQuizzes: DashboardBootstrapDto['inProgressQuizzes'];
  recentOwnedQuizzes: DashboardBootstrapDto['recentOwnedQuizzes'];
  recentPublicQuizzes: DashboardBootstrapDto['recentPublicQuizzes'];
  locale: string;
  copy: DashboardViewModelCopy;
}

interface BuildAdaptiveLearningCardsInput {
  adaptiveSubjects: PipelineJobHistoryItem[];
  locale: string;
  copy: DashboardViewModelCopy;
}

interface BuildInProgressLearningCardsInput {
  inProgressQuizzes: DashboardInProgressQuizDto[];
  locale: string;
  copy: DashboardViewModelCopy;
}

interface BuildContinueLearningInput
  extends BuildAdaptiveLearningCardsInput, BuildInProgressLearningCardsInput {}

const CONTINUE_LEARNING_CARD_LIMIT = 8;
const QUIZ_BUILDER_LIBRARY_HREF = '/my-quizzes';

function toTimestampMs(value?: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function formatLearningCardTime(
  value: string | number | null | undefined,
  locale: string,
  copy: DashboardViewModelCopy,
): string {
  const timestamp =
    typeof value === 'number' ? toTimestampMs(value) : value ? new Date(value).getTime() : null;

  if (!timestamp || !Number.isFinite(timestamp)) return copy.recentlyUpdated;

  const diffMs = Date.now() - timestamp;
  if (diffMs >= 0) {
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days === 0) return copy.today;
    if (days === 1) return copy.dayAgo(1);
    if (days <= 7) return copy.daysAgo(days);
  }

  return formatDate(timestamp, {
    locale: locale === 'vi' ? 'vi-VN' : 'en-GB',
    emptyLabel: copy.recentlyUpdated,
  });
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAdaptiveSubjectTitle(subject: PipelineJobHistoryItem): string {
  const filenameTitle = subject.filename.replace(/\.[^.]+$/, '');
  return requireFirstNonEmptyString(
    'dashboard adaptive subject title',
    subject.subject_id,
    filenameTitle,
    subject.job_id,
  );
}

function getAdaptiveSubjectProgress(subject: PipelineJobHistoryItem): number {
  const allConcepts = Math.max(0, subject.all_concept);
  const masteredConcepts = Math.max(0, subject.mastered_concept);

  if (allConcepts > 0) {
    return clampProgress((Math.min(masteredConcepts, allConcepts) / allConcepts) * 100);
  }

  return clampProgress(subject.progress_percent);
}

function buildAdaptiveLearningCards({
  adaptiveSubjects,
  locale,
  copy,
}: BuildAdaptiveLearningCardsInput): DashboardViewModel['continueLearning']['items'] {
  return adaptiveSubjects.slice(0, CONTINUE_LEARNING_CARD_LIMIT).map((subject) => ({
    id: `adaptive-${subject.job_id}`,
    title: getAdaptiveSubjectTitle(subject),
    category: copy.aiLearning,
    progress: getAdaptiveSubjectProgress(subject),
    href: ADAPTIVE_ROUTES.dashboard,
    tone: 'warm' as const,
    isAi: true,
    timeLabel: formatLearningCardTime(subject.completed_at, locale, copy),
  }));
}

function buildInProgressLearningCards({
  inProgressQuizzes,
  locale,
  copy,
}: BuildInProgressLearningCardsInput): DashboardViewModel['continueLearning']['items'] {
  return inProgressQuizzes
    .filter((quiz) => quiz.slug && quiz.totalQuestions > 0)
    .slice(0, CONTINUE_LEARNING_CARD_LIMIT)
    .map((quiz) => ({
      id: `in-progress-${quiz.quizId}`,
      title: quiz.title,
      category: copy.inProgress,
      progress: clampProgress((quiz.answeredCount / quiz.totalQuestions) * 100),
      href: ROUTES.QUIZ.VIEW(quiz.slug),
      tone: 'cool' as const,
      isAi: false,
      timeLabel: formatLearningCardTime(quiz.updatedAt, locale, copy),
    }));
}

function buildContinueLearning({
  adaptiveSubjects,
  inProgressQuizzes,
  locale,
  copy,
}: BuildContinueLearningInput): DashboardViewModel['continueLearning'] {
  const inProgressCards = buildInProgressLearningCards({ inProgressQuizzes, locale, copy });
  const adaptiveCards = buildAdaptiveLearningCards({ adaptiveSubjects, locale, copy });
  const items = [...inProgressCards, ...adaptiveCards].slice(0, CONTINUE_LEARNING_CARD_LIMIT);
  const viewAllHref =
    adaptiveCards.length > 0 ? ADAPTIVE_ROUTES.dashboard : QUIZ_BUILDER_LIBRARY_HREF;

  return { items, viewAllHref };
}

function buildWeekDays(
  weeklyActivity: DashboardStatsDto['weeklyActivity'],
  labels: string[],
): DashboardViewModel['progress']['weekDays'] {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  sunday.setHours(0, 0, 0, 0);

  return labels.map((label, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;

    return {
      label,
      active: (weeklyActivity[key]?.questionsReviewed ?? 0) > 0,
    };
  });
}

export function toDashboardViewModel({
  userName,
  stats,
  adaptiveSubjects,
  inProgressQuizzes,
  recentOwnedQuizzes,
  recentPublicQuizzes,
  locale,
  copy,
}: ToDashboardViewModelInput): DashboardViewModel {
  return {
    userName,
    locale,
    progress: {
      streak: stats.streak,
      accuracyPercent: clampProgress(stats.averageAccuracy),
      studyHours: Math.ceil(stats.totalReviewSessions * 0.4),
      dueCount: stats.dueCount,
      weekDays: buildWeekDays(stats.weeklyActivity, copy.weekdayLabels),
    },
    continueLearning: buildContinueLearning({
      adaptiveSubjects,
      inProgressQuizzes,
      locale,
      copy,
    }),
    recentOwnedQuizzes: recentOwnedQuizzes.map(toQuizListItemViewModel),
    recentPublicQuizzes: recentPublicQuizzes.map(toQuizListItemViewModel),
  };
}
