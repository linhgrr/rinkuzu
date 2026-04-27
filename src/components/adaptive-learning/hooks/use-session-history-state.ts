'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AdaptiveApiError,
  createSessionFromPipeline,
  getSubjectProgressHistory,
} from '../api-client';
import { saveSessionJobMapping } from '../session-storage';
import type { SessionHistoryItem } from '../types';

export const useSessionHistoryState = () => {
  const router = useRouter();
  const t = useTranslations('adaptiveLearning');
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapApiErrorToMessage = useCallback(
    (err: unknown) => {
      if (err instanceof AdaptiveApiError) {
        if (err.code === 'unauthorized') return t('processing.errors.unauthorized');
        if (err.code === 'temporary_unavailable') return t('processing.errors.serviceUnavailable');
        if (err.code === 'not_found') return t('subjectDetails.sessionMissing');
        if (err.code === 'conflict') return t('processing.errors.conflict');
        if (err.code === 'request_aborted' || err.code === 'network_error')
          return t('processing.errors.connectionInterrupted');
      }
      return t('processing.errors.generic');
    },
    [t],
  );

  useEffect(() => {
    let mounted = true;

    getSubjectProgressHistory(30)
      .then((data) => {
        if (mounted) setSessions(data);
      })
      .catch((err) => {
        if (mounted) {
          const message = mapApiErrorToMessage(err);
          setError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [mapApiErrorToMessage]);

  const handleOpenSession = useCallback(
    async (jobId: string) => {
      try {
        const session = await createSessionFromPipeline(jobId, 50);
        localStorage.setItem('al_session_id', session.session_id);
        saveSessionJobMapping(session.session_id, jobId);
        toast.success(t('processing.creatingSession'));
        router.push(`/adaptive-learning/subject/${session.session_id}`);
      } catch (err) {
        const message = mapApiErrorToMessage(err);
        setError(message);
        toast.error(message);
      }
    },
    [mapApiErrorToMessage, router, t],
  );

  return {
    error,
    handleOpenSession,
    loading,
    sessions,
  };
};
