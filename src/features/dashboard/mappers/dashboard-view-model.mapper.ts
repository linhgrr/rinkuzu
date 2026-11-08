import type {
  DashboardBootstrapDto,
  DashboardInProgressQuizDto,
  StarterQuizDto,
} from '@/dtos/dashboard';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { ROUTES } from '@/shared/constants/routes';
import { pickStarterQuizIndex, starterQuizHref } from '@/services/dashboard/starter-quizzes';
import { buildWeekDays } from '@/features/dashboard/mappers/dashboard-week-days';
import { formatDate } from '@/lib/formatters';
import { requireFirstNonEmptyString } from '@/lib/non-empty-string';
import type {
  DashboardStarterQuizViewModel,
  DashboardStarterViewModel,
  DashboardViewModel,
} from '@/features/dashboard/types/dashboard-view-model';
import { toQuizListItemViewModel } from '@/features/quiz/mappers/quiz-list.mapper';
import { toTimestampMs } from '@/lib/epoch';

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
  isNewLearner: DashboardBootstrapDto['isNewLearner'];
  starterQuizzes: DashboardBootstrapDto['starterQuizzes'];
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

interface BuildStarterInput {
  isNewLearner: boolean;
  starterQuizzes: StarterQuizDto[];
  locale: string;
}

const CONTINUE_LEARNING_CARD_LIMIT = 8;
const QUIZ_BUILDER_LIBRARY_HREF = '/my-quizzes';
const ADAPTIVE_UPLOAD_HREF = '/adaptive';
const STARTER_ALTERNATIVE_LIMIT = 2;

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
    // 'en-GB' used to sit here and read as a choice of British date order. It
    // never was one: resolveDateFormatter branches on isVi(locale) alone, so
    // every non-vi tag resolves to the same en-US formatter. Spelling it en-US
    // says what actually renders.
    locale: locale === 'vi' ? 'vi-VN' : 'en-US',
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

function toStarterQuizViewModel(quiz: StarterQuizDto): DashboardStarterQuizViewModel {
  return {
    slug: quiz.slug,
    title: quiz.title,
    questionCount: quiz.questionCount,
    href: starterQuizHref(quiz),
  };
}

/**
 * Only starters in the UI locale are listed (RIN-988). When none matches, the
 * first starter still leads, so a new learner always has a quiz to start.
 */
function buildStarter({
  isNewLearner,
  starterQuizzes,
  locale,
}: BuildStarterInput): DashboardStarterViewModel | null {
  if (!isNewLearner || starterQuizzes.length === 0) return null;

  const primaryIndex = pickStarterQuizIndex(starterQuizzes, locale);
  const primary = starterQuizzes[primaryIndex];
  if (!primary) return null;

  return {
    primary: toStarterQuizViewModel(primary),
    alternatives: starterQuizzes
      .filter((quiz, index) => index !== primaryIndex && quiz.locale === locale)
      .slice(0, STARTER_ALTERNATIVE_LIMIT)
      .map(toStarterQuizViewModel),
  };
}

export function toDashboardViewModel({
  userName,
  stats,
  adaptiveSubjects,
  inProgressQuizzes,
  recentOwnedQuizzes,
  recentPublicQuizzes,
  isNewLearner,
  starterQuizzes,
  locale,
  copy,
}: ToDashboardViewModelInput): DashboardViewModel {
  const starter = buildStarter({ isNewLearner, starterQuizzes, locale });

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
    starter,
    heroCtaHref: starter ? starter.primary.href : ADAPTIVE_UPLOAD_HREF,
  };
}
