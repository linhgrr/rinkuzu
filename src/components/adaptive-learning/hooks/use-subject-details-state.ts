'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  createSessionFromPipeline,
  getSubjectHistoryDetail,
  getSessionStatus,
  isSessionNotFoundError,
  prefetchStartLearningData,
} from '../api-client';
import { ADAPTIVE_ROUTES } from '../routes';
import { getJobIdForSession, saveSessionJobMapping } from '../session-storage';
import { getSessionStartFeedback } from '../session-start-feedback';
import type { SessionStatus, SubjectHistoryDetail } from '../types';

type TranslateFn = (key: string, values?: Record<string, any>) => string;

type SubjectTab = 'graph' | 'mastery' | 'history';

export const useSubjectDetailsState = (sessionId: string, t: TranslateFn) => {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [filename, setFilename] = useState(t('defaultLearningPath'));
  const [activeTab, setActiveTab] = useState<SubjectTab>('graph');
  const [jobId, setJobId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<SubjectHistoryDetail | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [didPrefetchStartLearning, setDidPrefetchStartLearning] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const storedFilename = localStorage.getItem('al_pipeline_filename');
      const storedSubjectName = localStorage.getItem('al_pipeline_subject_name');
      const mappedJobId = getJobIdForSession(sessionId);
      if (mounted) setFilename(storedSubjectName || storedFilename || t('defaultLearningPath'));
      if (mounted) setJobId(mappedJobId);

      try {
        const sessionStatus = await getSessionStatus(sessionId);
        if (mounted) setStatus(sessionStatus);
      } catch (error) {
        if (mounted && isSessionNotFoundError(error)) setActiveTab('history');
      } finally {
        if (mounted) setLoading(false);
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

  useEffect(() => {
    if (historyDetail || !jobId) return;

    let mounted = true;
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const hydrateHistory = () => {
      getSubjectHistoryDetail(jobId)
        .then((detail) => {
          if (mounted) setHistoryDetail(detail);
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
  }, [historyDetail, jobId]);

  useEffect(() => {
    if (activeTab !== 'history' || historyDetail || !jobId) return;

    let mounted = true;
    setHistoryLoading(true);
    getSubjectHistoryDetail(jobId)
      .then((detail) => {
        if (mounted) setHistoryDetail(detail);
      })
      .catch(() => {
        // Ignore if not persisted yet.
      })
      .finally(() => {
        if (mounted) setHistoryLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeTab, historyDetail, jobId]);

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
    setSessionNotice(null);

    if (status || !jobId) {
      router.push(ADAPTIVE_ROUTES.exercise(sessionId));
      return;
    }

    setStartingSession(true);
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
        setSessionNotice(feedback.message);
        toast.error(feedback.message);
      })
      .finally(() => {
        setStartingSession(false);
      });
  }, [jobId, router, sessionId, status, t]);

  const handlePrefetchStartLearning = useCallback(() => {
    if (didPrefetchStartLearning) return;

    setDidPrefetchStartLearning(true);
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
    setActiveTab,
    startingSession,
    status,
    summary,
  };
};
