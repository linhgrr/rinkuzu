import type {
  DashboardBootstrapDto,
  DashboardInProgressQuizDto,
  DashboardStatsDto,
  StarterQuizDto,
} from '@/dtos/dashboard';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';
import { toPipelineJobHistoryItem } from '@/features/adaptive/mappers/pipeline.mapper';
import type {
  IDashboardRepository,
  DashboardUserProgressRecord,
} from '@/interfaces/repositories/IDashboardRepository';
import type { IDashboardQuizRepository } from '@/interfaces/repositories/IDashboardQuizRepository';
import type { QuizFindFilter } from '@/interfaces/repositories/IQuizRepository';
import type {
  IDashboardService,
  PostSignInTargetInput,
} from '@/interfaces/services/IDashboardService';
import {
  buildAdaptiveServiceHeaders,
  buildAdaptiveUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import { fetchApiData } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { DashboardDtoMapper } from '@/mappers/dashboard/DashboardDtoMapper';
import { QuizListDtoMapper } from '@/mappers/quiz/QuizListDtoMapper';
import type { QuizListItemDto } from '@/dtos/quiz';
import type { components } from '@/generated/adaptive-api';
import { ROUTES } from '@/shared/constants/routes';
import { POST_SIGNIN_STARTER_ENTRY } from '@/shared/constants/starter-quiz';
import {
  STARTER_QUIZ_ALLOWLIST,
  pickStarterQuizIndex,
  resolveStarterQuizzes,
  type StarterQuizAllowlistEntry,
} from '@/services/dashboard/starter-quizzes';

type ApiSchemas = components['schemas'];
const HOME_ADAPTIVE_SUBJECT_LIMIT = 4;
const HOME_ADAPTIVE_SUBJECT_TIMEOUT_MS = 1_500;
const HOME_IN_PROGRESS_QUIZ_LIMIT = 6;
const HOME_QUIZ_SECTION_LIMIT = 4;

interface DashboardRecentQuizQuery {
  filter: QuizFindFilter;
  warningMessage: string;
}

interface DashboardStarterState {
  isNewLearner: boolean;
  starterQuizzes: StarterQuizDto[];
}

const NO_STARTER_STATE: DashboardStarterState = { isNewLearner: false, starterQuizzes: [] };

const EMPTY_DASHBOARD_USER_PROGRESS: DashboardUserProgressRecord = {
  currentStreak: 0,
  longestStreak: 0,
  streakFreezeCount: 0,
  totalXp: 0,
  weeklyActivity: {},
  totalQuestionsLearned: 0,
  totalReviewSessions: 0,
  averageAccuracy: 0,
};

export class DashboardService implements IDashboardService {
  constructor(
    private readonly repository: IDashboardRepository,
    private readonly quizRepository: IDashboardQuizRepository,
    private readonly starterAllowlist: readonly StarterQuizAllowlistEntry[] = STARTER_QUIZ_ALLOWLIST,
  ) {}

  async getStats(userId: string): Promise<DashboardStatsDto> {
    const [progress, dueCount] = await Promise.all([
      this.repository.findUserProgress(userId),
      this.repository.countDueQuestions(userId, new Date()),
    ]);
    return DashboardDtoMapper.toStats(progress ?? EMPTY_DASHBOARD_USER_PROGRESS, dueCount);
  }

  private async getAdaptiveSubjects(userId: string): Promise<PipelineJobHistoryItem[]> {
    const timeoutMs = Math.min(resolveAdaptiveProxyTimeoutMs(), HOME_ADAPTIVE_SUBJECT_TIMEOUT_MS);

    try {
      const data = await fetchApiData<ApiSchemas['SubjectHistoryListResponse']>(
        buildAdaptiveUrl('/history/subjects'),
        {
          headers: buildAdaptiveServiceHeaders(userId),
          cache: 'no-store',
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      return data.subjects.map(toPipelineJobHistoryItem).slice(0, HOME_ADAPTIVE_SUBJECT_LIMIT);
    } catch (error) {
      logger.warn({ error }, 'Failed fetching adaptive subjects for home dashboard');
      return [];
    }
  }

  private async getInProgressQuizzes(userId: string): Promise<DashboardInProgressQuizDto[]> {
    try {
      const records = await this.repository.findInProgressQuizzes(
        userId,
        HOME_IN_PROGRESS_QUIZ_LIMIT,
      );
      return records.map(DashboardDtoMapper.toInProgressQuiz);
    } catch (error) {
      logger.warn({ error }, 'Failed fetching in-progress quizzes for home dashboard');
      return [];
    }
  }

  private async getRecentQuizzes({
    filter,
    warningMessage,
  }: DashboardRecentQuizQuery): Promise<QuizListItemDto[]> {
    try {
      const quizzes = await this.quizRepository.findRecent(filter, {
        limit: HOME_QUIZ_SECTION_LIMIT,
        sort: { createdAt: -1 },
        populate: ['author'],
      });
      return quizzes.map(QuizListDtoMapper.toListItem);
    } catch (error) {
      logger.warn({ error }, warningMessage);
      return [];
    }
  }

  /**
   * A new learner (no submitted attempt, no authored quiz) is pointed at a short
   * curated public quiz. Fails open: any lookup error renders today's dashboard.
   */
  private async getStarterState(userId: string): Promise<DashboardStarterState> {
    try {
      const [hasSubmittedAttempt, hasAuthoredQuiz, candidates] = await Promise.all([
        this.repository.hasSubmittedAttempt(userId),
        this.repository.hasAuthoredQuiz(userId),
        this.repository.findStarterQuizCandidates(this.starterAllowlist.map(({ slug }) => slug)),
      ]);
      if (hasSubmittedAttempt || hasAuthoredQuiz) return NO_STARTER_STATE;

      const { starterQuizzes, dropped } = resolveStarterQuizzes({
        allowlist: this.starterAllowlist,
        candidates,
      });
      for (const { slug, reason } of dropped) {
        logger.warn({ slug, reason }, 'Dropped starter quiz from home dashboard allowlist');
      }
      return { isNewLearner: true, starterQuizzes };
    } catch (error) {
      logger.warn({ error }, 'Failed resolving starter quizzes for home dashboard');
      return NO_STARTER_STATE;
    }
  }

  /**
   * Where sign-in with no explicit destination lands (RIN-913): a new learner goes
   * straight into the starter quiz in their locale; anyone else, a learner who
   * skipped, or any lookup failure goes to the dashboard. Uses the same
   * eligibility as the dashboard starter block, which does not check adaptive
   * uploads either.
   */
  async getPostSignInHref({
    userId,
    locale,
    starterSkipped,
  }: PostSignInTargetInput): Promise<string> {
    if (starterSkipped) return ROUTES.DASHBOARD;
    const { isNewLearner, starterQuizzes } = await this.getStarterState(userId);
    if (!isNewLearner) return ROUTES.DASHBOARD;
    const starter = starterQuizzes[pickStarterQuizIndex(starterQuizzes, locale)];
    return starter
      ? `${ROUTES.QUIZ.VIEW(starter.slug)}?entry=${POST_SIGNIN_STARTER_ENTRY}`
      : ROUTES.DASHBOARD;
  }

  async getBootstrapData(userId: string): Promise<DashboardBootstrapDto> {
    const [
      stats,
      adaptiveSubjects,
      inProgressQuizzes,
      recentOwnedQuizzes,
      recentPublicQuizzes,
      starterState,
    ] = await Promise.all([
      this.getStats(userId),
      this.getAdaptiveSubjects(userId),
      this.getInProgressQuizzes(userId),
      this.getRecentQuizzes({
        filter: { author: userId },
        warningMessage: 'Failed fetching recent owned quizzes for home dashboard',
      }),
      this.getRecentQuizzes({
        filter: { visibility: 'public', excludeAuthor: userId },
        warningMessage: 'Failed fetching recent public quizzes for home dashboard',
      }),
      this.getStarterState(userId),
    ]);

    return {
      stats,
      adaptiveSubjects,
      inProgressQuizzes,
      recentOwnedQuizzes,
      recentPublicQuizzes,
      ...starterState,
    };
  }
}
