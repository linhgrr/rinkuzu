import { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  checkApiHealth,
  createSessionFromPipeline,
  deleteSubject,
  getSubjectProgressHistory,
  getSubjects,
} from '@/features/adaptive/lib/api-client';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import { saveSessionJobMapping } from '../lib/session-storage';
import { getSessionStartFeedback } from '../lib/session-start-feedback';
import { useJobLibrary } from './use-job-library';
import {
  buildDashboardSubjectFromJob,
  toDashboardSubject,
  type DashboardSubject,
} from '@/features/adaptive/lib/dashboard-view-model';
import type {
  PipelineJobHistoryItem,
  SessionHistoryItem,
  TranslateFn,
} from '@/features/adaptive/types';

const DAILY_GOAL_TARGET = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const toTimestampMs = (value: number): number => (value < 1_000_000_000_000 ? value * 1000 : value);

const getDayStart = (value: number): number => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const calculateLearningStreak = (sessions: SessionHistoryItem[]): number => {
  if (sessions.length === 0) return 0;

  const uniqueDayStarts = new Set<number>();
  for (const session of sessions) {
    if (session.total_answered > 0) {
      uniqueDayStarts.add(getDayStart(toTimestampMs(session.updated_at || session.created_at)));
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

const clearSelectedPipelineJob = (jobId: string) => {
  if (localStorage.getItem('al_pipeline_job_id') !== jobId) return;

  localStorage.removeItem('al_pipeline_job_id');
  localStorage.removeItem('al_pipeline_filename');
  localStorage.removeItem('al_pipeline_subject_name');
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
  sessionHistory: SessionHistoryItem[];
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
    sessionHistory: initialSessionHistory,
  });

  const jobLibrary = useJobLibrary({
    enabled: dashboardState.apiOnline === true,
    initialJobs: [],
  });
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<PipelineJobHistoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const refreshSubjects = useCallback(async () => {
    try {
      const data = await getSubjects();
      dispatch({ type: 'patch', value: { subjects: data } });
    } catch (e) {
      console.error('Failed to refresh subjects', e);
    }
  }, []);

  const handleGoUpload = useCallback(() => {
    router.push(ADAPTIVE_ROUTES.upload);
  }, [router]);

  const handleOpenSubject = useCallback(
    async (jobId: string) => {
      if (loadingJobId || deletingJobId) return;

      setLoadingJobId(jobId);
      try {
        const session = await createSessionFromPipeline(jobId, 50);
        localStorage.setItem('al_session_id', session.session_id);
        saveSessionJobMapping(session.session_id, jobId);
        toast.success(t('creatingSession'));
        router.push(ADAPTIVE_ROUTES.subject(session.session_id));
      } catch (err) {
        console.error(`Error creating session: ${(err as Error).message}`);
        const feedback = getSessionStartFeedback(tAdaptive, 'dashboard', err);
        toast.error(feedback.message);
        setLoadingJobId(null);
      }
    },
    [deletingJobId, loadingJobId, router, t, tAdaptive],
  );

  const handleDeleteClick = useCallback((job: PipelineJobHistoryItem) => {
    setItemToDelete(job);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!itemToDelete || loadingJobId || deletingJobId) return;

    setDeletingJobId(itemToDelete.job_id);
    try {
      await deleteSubject(itemToDelete.job_id, true);
      await Promise.all([refreshSubjects(), jobLibrary.refresh()]);
      clearSelectedPipelineJob(itemToDelete.job_id);
      toast.success(t('deleteSuccess'));
    } catch (err) {
      console.error(`Error deleting subject: ${(err as Error).message}`);
      toast.error(t('deleteFailed'));
    } finally {
      setDeletingJobId(null);
      setItemToDelete(null);
    }
  }, [deletingJobId, itemToDelete, jobLibrary, loadingJobId, refreshSubjects, t]);

  const handleCancelDelete = useCallback(() => {
    if (!deletingJobId) setItemToDelete(null);
  }, [deletingJobId]);

  // Map of completed + mastery-enriched subjects (from getSubjects), keyed by job_id,
  // so completed cards can show mastery %/labels via toDashboardSubject.
  const enrichedByJobId = useMemo(() => {
    const map = new Map<string, PipelineJobHistoryItem>();
    for (const subject of dashboardState.subjects) {
      map.set(subject.job_id, subject);
    }
    return map;
  }, [dashboardState.subjects]);

  // Merge all-status jobs (live polling) with completed mastery enrichment.
  const mergedSubjects = useMemo<DashboardSubject[]>(() => {
    return jobLibrary.jobs.map((job) => {
      const enriched = job.status === 'completed' ? enrichedByJobId.get(job.job_id) : undefined;
      return enriched
        ? toDashboardSubject(enriched, locale, t)
        : buildDashboardSubjectFromJob(job, t, tAdaptive);
    });
  }, [enrichedByJobId, jobLibrary.jobs, locale, t, tAdaptive]);

  const normalizedSubjects = useMemo(() => {
    return mergedSubjects.map((subject) => ({
      subject,
      normalizedDisplayName: subject.displayTitle.toLowerCase(),
    }));
  }, [mergedSubjects]);

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return normalizedSubjects.map(({ subject }) => subject);

    return normalizedSubjects.reduce<DashboardSubject[]>((matches, item) => {
      if (item.normalizedDisplayName.includes(normalizedQuery)) {
        matches.push(item.subject);
      }
      return matches;
    }, []);
  }, [deferredSearchQuery, normalizedSubjects]);

  const streakDays = useMemo(
    () => calculateLearningStreak(dashboardState.sessionHistory),
    [dashboardState.sessionHistory],
  );

  const dailyGoalProgress = useMemo(() => {
    const todayStart = getDayStart(Date.now());
    const current = dashboardState.sessionHistory.filter((session) => {
      if (session.total_answered <= 0) return false;
      const dayStart = getDayStart(toTimestampMs(session.updated_at || session.created_at));
      return dayStart === todayStart;
    }).length;

    return {
      current,
      total: DAILY_GOAL_TARGET,
      percent: Math.min(100, Math.round((current / DAILY_GOAL_TARGET) * 100)),
    };
  }, [dashboardState.sessionHistory]);

  const upNextSubject = dashboardState.subjects.length > 0 ? dashboardState.subjects[0] : null;

  useEffect(() => {
    router.prefetch(ADAPTIVE_ROUTES.upload);
  }, [router]);

  useEffect(() => {
    let isActive = true;

    const hydrateDashboard = async () => {
      dispatch({ type: 'patch', value: { error: null } });

      if (didHydrateFromServer) {
        if (!isActive) return;
        const healthResult = await checkApiHealth().catch(() => false);
        if (isActive) {
          dispatch({
            type: 'hydrate',
            value: {
              apiOnline: healthResult,
              error: healthResult ? initialError : (initialError ?? t('connectionLimited')),
            },
          });
        }
        return;
      }

      dispatch({ type: 'patch', value: { loading: true } });
      const [healthResult, subjectsResult, historyResult] = await Promise.allSettled([
        checkApiHealth(),
        getSubjects(),
        getSubjectProgressHistory(5),
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
        nextState.sessionHistory = historyResult.value;
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
    itemToDelete,
    loading: dashboardState.loading,
    loadingJobId,
    retry: jobLibrary.retry,
    searchQuery,
    sessionHistory: dashboardState.sessionHistory,
    setSearchQuery,
    streakDays,
    upNextSubject,
  };
};
