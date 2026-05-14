'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  createSessionFromPipeline,
  getSubjectHistoryDetail,
  getSessionStatus,
  isSessionNotFoundError,
  prefetchStartLearningData,
} from '@/features/adaptive-learning/lib/api-client';
import { ADAPTIVE_ROUTES } from '@/features/adaptive-learning/lib/routes';
import { getJobIdForSession, saveSessionJobMapping } from '../lib/session-storage';
import { getSessionStartFeedback } from '../lib/session-start-feedback';
import type {
  SessionStatus,
  SubjectHistoryDetail,
  TranslateFn,
} from '@/features/adaptive-learning/types';

type SubjectTab = 'graph' | 'mastery' | 'history';

interface SubjectDetailsState {
  status: SessionStatus | null;
  loading: boolean;
  filename: string;
  activeTab: SubjectTab;
  jobId: string | null;
  historyDetail: SubjectHistoryDetail | null;
  historyLoading: boolean;
  didPrefetchStartLearning: boolean;
  startingSession: boolean;
  sessionNotice: string | null;
}

type SubjectDetailsAction =
  | { type: 'patch'; value: Partial<SubjectDetailsState> }
  | { type: 'setActiveTab'; value: SubjectTab };

function createInitialState(t: TranslateFn): SubjectDetailsState {
  return {
    status: null,
    loading: true,
    filename: t('defaultLearningPath'),
    activeTab: 'graph',
    jobId: null,
    historyDetail: null,
    historyLoading: false,
    didPrefetchStartLearning: false,
    startingSession: false,
    sessionNotice: null,
  };
}

function subjectDetailsReducer(
  state: SubjectDetailsState,
  action: SubjectDetailsAction,
): SubjectDetailsState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'setActiveTab':
      return { ...state, activeTab: action.value };
    default:
      return state;
  }
}

export const useSubjectDetailsState = (sessionId: string, t: TranslateFn) => {
  const router = useRouter();
  const [state, dispatch] = useReducer(subjectDetailsReducer, t, createInitialState);
  const historyDetailPromiseRef = useRef<Promise<SubjectHistoryDetail> | null>(null);

  const {
    status,
    loading,
    filename,
    activeTab,
    jobId,
    historyDetail,
    historyLoading,
    didPrefetchStartLearning,
    startingSession,
    sessionNotice,
  } = state;

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const storedFilename = localStorage.getItem('al_pipeline_filename');
      const storedSubjectName = localStorage.getItem('al_pipeline_subject_name');
      const mappedJobId = getJobIdForSession(sessionId);
      const nextState: Partial<SubjectDetailsState> = {
        filename: storedSubjectName || storedFilename || t('defaultLearningPath'),
        jobId: mappedJobId,
        loading: false,
      };

      try {
        const sessionStatus = await getSessionStatus(sessionId);
        nextState.status = sessionStatus;
      } catch (error) {
        if (isSessionNotFoundError(error)) {
          nextState.activeTab = 'history';
        }
      }

      if (mounted) {
        dispatch({ type: 'patch', value: nextState });
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [sessionId, t]);

  useEffect(() => {
    router.prefetch(ADAPTIVE_ROUTES.dashboard);
    router.prefetch(ADAPTIVE_ROUTES.exercise(sessionId));
  }, [router, sessionId]);

  const fetchHistoryDetail = useCallback(async () => {
    if (!jobId) return null;
    if (!historyDetailPromiseRef.current) {
      historyDetailPromiseRef.current = getSubjectHistoryDetail(jobId).finally(() => {
        historyDetailPromiseRef.current = null;
      });
    }

    return historyDetailPromiseRef.current;
  }, [jobId]);

  useEffect(() => {
    if (historyDetail || !jobId) return;

    let mounted = true;
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const hydrateHistory = () => {
      void fetchHistoryDetail()
        .then((detail) => {
          if (mounted && detail) {
            dispatch({ type: 'patch', value: { historyDetail: detail } });
          }
        })
        .catch(() => {
          // Ignore warm-up failures; explicit tab loading handles retry UX.
        });
    };

    let idleId: number | undefined;
    let timeoutId: number | undefined;

    if (windowWithIdle.requestIdleCallback)
      idleId = windowWithIdle.requestIdleCallback(hydrateHistory, { timeout: 1200 });
    else timeoutId = window.setTimeout(hydrateHistory, 300);

    return () => {
      mounted = false;
      if (idleId !== undefined && windowWithIdle.cancelIdleCallback)
        windowWithIdle.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [fetchHistoryDetail, historyDetail, jobId]);

  useEffect(() => {
    if (activeTab !== 'history' || historyDetail || !jobId) return;

    let mounted = true;
    dispatch({ type: 'patch', value: { historyLoading: true } });
    void (async () => {
      const nextState: Partial<SubjectDetailsState> = {
        historyLoading: false,
      };

      try {
        const detail = await fetchHistoryDetail();
        if (detail) {
          nextState.historyDetail = detail;
        }
      } catch {
        // Ignore if not persisted yet.
      }

      if (mounted) {
        dispatch({ type: 'patch', value: nextState });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [activeTab, fetchHistoryDetail, historyDetail, jobId]);

  const summary = useMemo(() => {
    if (!status) return t('subjectDetails.summaryFallback');

    return t('subjectDetails.summary', {
      concepts: status.total_concepts,
      accuracy: Math.round(status.accuracy * 100),
    });
  }, [status, t]);

  const handleBackToDashboard = useCallback(() => {
    router.push(ADAPTIVE_ROUTES.dashboard);
  }, [router]);

  const handleStartLearning = useCallback(() => {
    dispatch({ type: 'patch', value: { sessionNotice: null } });

    if (status || !jobId) {
      router.push(ADAPTIVE_ROUTES.exercise(sessionId));
      return;
    }

    dispatch({ type: 'patch', value: { startingSession: true } });
    void createSessionFromPipeline(jobId, 50)
      .then((session) => {
        localStorage.setItem('al_session_id', session.session_id);
        saveSessionJobMapping(session.session_id, jobId);
        toast.success(t('processing.creatingSession'));
        router.push(ADAPTIVE_ROUTES.exercise(session.session_id));
      })
      .catch((error) => {
        console.error(`Error creating session from subject details: ${(error as Error).message}`);
        const feedback = getSessionStartFeedback(t, 'subjectDetails', error);
        dispatch({ type: 'patch', value: { sessionNotice: feedback.message } });
        toast.error(feedback.message);
      })
      .finally(() => {
        dispatch({ type: 'patch', value: { startingSession: false } });
      });
  }, [jobId, router, sessionId, status, t]);

  const handlePrefetchStartLearning = useCallback(() => {
    if (didPrefetchStartLearning) return;

    dispatch({ type: 'patch', value: { didPrefetchStartLearning: true } });
    void prefetchStartLearningData(sessionId);
  }, [didPrefetchStartLearning, sessionId]);

  return {
    activeTab,
    filename,
    handleBackToDashboard,
    handlePrefetchStartLearning,
    handleStartLearning,
    historyDetail,
    historyLoading,
    loading,
    sessionNotice,
    setActiveTab: (tab: SubjectTab) => dispatch({ type: 'setActiveTab', value: tab }),
    startingSession,
    status,
    summary,
  };
};
