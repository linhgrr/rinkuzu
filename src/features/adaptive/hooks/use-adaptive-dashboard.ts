import { useRouter } from '@/i18n/navigation';
import { useDeferredValue, useEffect, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  checkApiHealth,
  deleteSubject,
  getSubjectProgressHistory,
  getSubjects,
  getSubjectsFresh,
} from '@/features/adaptive/lib/adaptive-api-methods';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { clearSelectedPipelineJob, saveSelectedPipelineJob } from '../lib/session-storage';
import { useJobLibrary } from './use-job-library';
import { useStartAdaptiveSubject } from './use-start-adaptive-subject';
import {
  buildDashboardSubjectFromJob,
  toDashboardSubject,
} from '@/features/adaptive/mappers/dashboard.mapper';
import { toSessionHistoryViewModels } from '@/features/adaptive/mappers/session-history.mapper';
import type { SessionHistoryItem } from '@/features/adaptive/types/history';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';
import type {
  DashboardSubject,
  DashboardSubjectExercise,
} from '@/features/adaptive/types/dashboard-view-model';
import type { SessionHistoryViewModel } from '@/features/adaptive/types/session-history-view-model';

const DAILY_GOAL_TARGET = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const toTimestampMs = (value: number): number => (value < 1_000_000_000_000 ? value * 1000 : value);

const getDayStart = (value: number): number => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const calculateLearningStreak = (sessions: SessionHistoryViewModel[]): number => {
  if (sessions.length === 0) return 0;

  const uniqueDayStarts = new Set<number>();
  for (const session of sessions) {
    if (session.totalAnswered > 0) {
      uniqueDayStarts.add(getDayStart(toTimestampMs(session.lastActivityAt)));
    }
  }
  const dayStarts = Array.from(uniqueDayStarts).sort((a, b) => b - a);

  if (dayStarts.length === 0) return 0;

  let streak = 0;
  let expectedDay = getDayStart(Date.now());

  for (const day of dayStarts) {
    if (day === expectedDay) {
      streak += 1;
      expectedDay -= ONE_DAY_MS;
      continue;
    }

    if (streak === 0 && day === expectedDay - ONE_DAY_MS) {
      streak += 1;
      expectedDay = day - ONE_DAY_MS;
      continue;
    }

    break;
  }

  return streak;
};

type UseAdaptiveDashboardParams = {
  initialSubjects: PipelineJobHistoryItem[];
  initialSessionHistory: SessionHistoryItem[];
  initialApiOnline: boolean | null;
  initialError: string | null;
  didHydrateFromServer: boolean;
  locale: string;
  t: TranslateFn;
  tAdaptive: TranslateFn;
};

type AdaptiveDashboardState = {
  subjects: PipelineJobHistoryItem[];
  loading: boolean;
  error: string | null;
  apiOnline: boolean | null;
  sessionHistory: SessionHistoryViewModel[];
};

type AdaptiveDashboardAction =
  | { type: 'patch'; value: Partial<AdaptiveDashboardState> }
  | { type: 'hydrate'; value: Partial<AdaptiveDashboardState> };

const adaptiveDashboardReducer = (
  state: AdaptiveDashboardState,
  action: AdaptiveDashboardAction,
): AdaptiveDashboardState => {
  switch (action.type) {
    case 'patch':
    case 'hydrate':
      return { ...state, ...action.value };
    default:
      return state;
  }
};

export const useAdaptiveDashboard = ({
  initialSubjects,
  initialSessionHistory,
  initialApiOnline,
  initialError,
  didHydrateFromServer,
  locale,
  t,
  tAdaptive,
}: UseAdaptiveDashboardParams) => {
  const router = useRouter();

  const [dashboardState, dispatch] = useReducer(adaptiveDashboardReducer, {
    subjects: initialSubjects,
    loading: false,
    error: initialError,
    apiOnline: initialApiOnline,
    sessionHistory: toSessionHistoryViewModels(initialSessionHistory),
  });

  const jobLibrary = useJobLibrary({
    enabled: dashboardState.apiOnline === true,
    initialJobs: [],
  });
  const { loadingJobId, startSubject } = useStartAdaptiveSubject({ t, tAdaptive });
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DashboardSubject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [todayStart, setTodayStart] = useState<number | null>(null);
  const refreshedCompletionKeysRef = useRef(new Set<string>());
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const refreshSubjects = async () => {
    try {
      const data = await getSubjects();
      dispatch({ type: 'patch', value: { subjects: data } });
    } catch (e) {
      console.error('Failed to refresh subjects', e);
    }
  };

  const handleGoUpload = () => {
    router.push(ADAPTIVE_ROUTES.upload);
  };

  const handleOpenSubject = (jobId: string) => {
    if (!deletingJobId) {
      const subject = mergedSubjects.find((item) => item.jobId === jobId);
      if (subject) {
        void startSubject(jobId, {
          filename: subject.filename,
          subjectName: subject.displayTitle,
        });
      } else {
        void startSubject(jobId);
      }
    }
  };

  const handleViewProcessing = (subject: DashboardSubject) => {
    saveSelectedPipelineJob({
      jobId: subject.jobId,
      filename: subject.filename,
      subjectName: subject.displayTitle,
    });
    router.push(ADAPTIVE_ROUTES.processing);
  };

  const handleDeleteClick = (subject: DashboardSubject) => {
    setItemToDelete(subject);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || loadingJobId || deletingJobId) return;

    setDeletingJobId(itemToDelete.jobId);
    try {
      await deleteSubject(itemToDelete.jobId, true);
      await Promise.all([refreshSubjects(), jobLibrary.refresh()]);
      clearSelectedPipelineJob(itemToDelete.jobId);
      toast.success(t('deleteSuccess'));
      setDeletingJobId(null);
      setItemToDelete(null);
    } catch (err) {
      console.error(`Error deleting subject: ${(err as Error).message}`);
      toast.error(t('deleteFailed'));
      setDeletingJobId(null);
      setItemToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    if (!deletingJobId) setItemToDelete(null);
  };

  // Map of completed + mastery-enriched subjects (from getSubjects), keyed by job_id,
  // so completed cards can show mastery %/labels via toDashboardSubject.
  const enrichedByJobId = (() => {
    const map = new Map<string, PipelineJobHistoryItem>();
    for (const subject of dashboardState.subjects) {
      map.set(subject.job_id, subject);
    }
    return map;
  })();

  const completedJobsNeedingEnrichmentKey = (() => {
    const jobIds: string[] = [];
    for (const job of jobLibrary.jobs) {
      if (job.status === 'completed' && !enrichedByJobId.has(job.job_id)) {
        jobIds.push(job.job_id);
      }
    }
    return jobIds.sort().join(',');
  })();

  useEffect(() => {
    if (
      dashboardState.apiOnline !== true ||
      !completedJobsNeedingEnrichmentKey ||
      refreshedCompletionKeysRef.current.has(completedJobsNeedingEnrichmentKey)
    ) {
      return;
    }

    refreshedCompletionKeysRef.current.add(completedJobsNeedingEnrichmentKey);
    void getSubjectsFresh()
      .then((subjects) => {
        dispatch({ type: 'patch', value: { subjects } });
      })
      .catch((error) => {
        refreshedCompletionKeysRef.current.delete(completedJobsNeedingEnrichmentKey);
        console.error('Failed to enrich completed subjects', error);
      });
  }, [completedJobsNeedingEnrichmentKey, dashboardState.apiOnline]);

  // Exercise-history by job_id: drives the card status pill so a subject the
  // learner has practised shows "In progress"/"Completed" instead of mastery-only.
  const exerciseByJobId = (() => {
    const map = new Map<string, DashboardSubjectExercise>();
    for (const session of dashboardState.sessionHistory) {
      map.set(session.jobId, {
        status: session.status,
        totalAnswered: session.totalAnswered,
        progressPercent: session.progressPercent,
      });
    }
    return map;
  })();

  // Merge all-status jobs (live polling) with completed mastery enrichment.
  const mergedSubjects: DashboardSubject[] = jobLibrary.jobs.map((job) => {
    const enriched = job.status === 'completed' ? enrichedByJobId.get(job.job_id) : undefined;
    return enriched
      ? toDashboardSubject(enriched, locale, t, exerciseByJobId.get(job.job_id) ?? null)
      : buildDashboardSubjectFromJob(job, t, tAdaptive);
  });

  const normalizedSubjects = mergedSubjects.map((subject) => ({
    subject,
    normalizedDisplayName: subject.displayTitle.toLowerCase(),
  }));

  const filteredSubjects = (() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return normalizedSubjects.map(({ subject }) => subject);

    return normalizedSubjects.reduce<DashboardSubject[]>((matches, item) => {
      if (item.normalizedDisplayName.includes(normalizedQuery)) {
        matches.push(item.subject);
      }
      return matches;
    }, []);
  })();

  const streakDays = calculateLearningStreak(dashboardState.sessionHistory);

  const dailyGoalProgress = (() => {
    if (todayStart === null) {
      return {
        current: 0,
        total: DAILY_GOAL_TARGET,
        percent: 0,
      };
    }

    const current = dashboardState.sessionHistory.filter((session) => {
      if (session.totalAnswered <= 0) return false;
      const dayStart = getDayStart(toTimestampMs(session.lastActivityAt));
      return dayStart === todayStart;
    }).length;

    return {
      current,
      total: DAILY_GOAL_TARGET,
      percent: Math.min(100, Math.round((current / DAILY_GOAL_TARGET) * 100)),
    };
  })();

  const upNextSubject = mergedSubjects.length > 0 ? mergedSubjects[0] : null;

  useEffect(() => {
    router.prefetch(ADAPTIVE_ROUTES.upload);
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => setTodayStart(getDayStart(Date.now())));
  }, []);

  useEffect(() => {
    let isActive = true;

    const hydrateDashboard = async () => {
      dispatch({ type: 'patch', value: { error: null } });

      if (didHydrateFromServer) {
        if (!isActive) return;
        const healthResult = await checkApiHealth().catch(() => false);
        const [subjectsResult, historyResult] = healthResult
          ? await Promise.all([
              getSubjects().catch(() => null),
              getSubjectProgressHistory(50).catch(() => null),
            ])
          : [null, null];
        const didRecover = healthResult && subjectsResult !== null && historyResult !== null;
        if (isActive) {
          dispatch({
            type: 'hydrate',
            value: {
              apiOnline: healthResult,
              error: didRecover ? null : (initialError ?? t('connectionLimited')),
              ...(subjectsResult ? { subjects: subjectsResult } : {}),
              ...(historyResult
                ? { sessionHistory: toSessionHistoryViewModels(historyResult) }
                : {}),
            },
          });
        }
        return;
      }

      dispatch({ type: 'patch', value: { loading: true } });
      const [healthResult, subjectsResult, historyResult] = await Promise.allSettled([
        checkApiHealth(),
        getSubjects(),
        getSubjectProgressHistory(50),
      ]);
      const nextState: Partial<AdaptiveDashboardState> = {
        loading: false,
        apiOnline: healthResult.status === 'fulfilled' ? healthResult.value : false,
      };
      if (nextState.apiOnline === false) {
        nextState.error = t('connectionLimited');
      }
      if (subjectsResult.status === 'fulfilled') {
        nextState.subjects = subjectsResult.value;
      } else {
        console.error('Failed to hydrate subjects', subjectsResult.reason);
        nextState.error = t('connectionLimited');
      }

      if (historyResult.status === 'fulfilled') {
        nextState.sessionHistory = toSessionHistoryViewModels(historyResult.value);
      } else {
        console.error('Failed to hydrate session history', historyResult.reason);
      }

      if (isActive) {
        dispatch({ type: 'hydrate', value: nextState });
      }
    };

    void hydrateDashboard();

    return () => {
      isActive = false;
    };
  }, [didHydrateFromServer, initialError, t]);

  return {
    apiOnline: dashboardState.apiOnline,
    busyJobId: jobLibrary.busyJobId,
    cancel: jobLibrary.cancel,
    dailyGoalProgress,
    deletingJobId,
    error: dashboardState.error,
    filteredSubjects,
    handleCancelDelete,
    handleConfirmDelete,
    handleDeleteClick,
    handleGoUpload,
    handleOpenSubject,
    handleViewProcessing,
    itemToDelete,
    loading: dashboardState.loading,
    libraryLoading: jobLibrary.loading,
    loadingJobId,
    retry: jobLibrary.retry,
    searchQuery,
    sessionHistory: dashboardState.sessionHistory,
    setSearchQuery,
    streakDays,
    upNextSubject,
  };
};
