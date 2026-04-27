'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createSessionFromPipeline, getSubjectProgressHistory } from '../api-client';
import { saveSessionJobMapping } from '../session-storage';
import type { SessionHistoryItem } from '../types';

export const useSessionHistoryState = () => {
  const router = useRouter();
  const t = useTranslations('adaptiveLearning');
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    getSubjectProgressHistory(30)
      .then((data) => {
        if (mounted) setSessions(data);
      })
      .catch((err) => {
        if (mounted) {
          const message = err instanceof Error ? err.message : String(err);
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
  }, []);

  const handleOpenSession = useCallback(
    async (jobId: string) => {
      try {
        const session = await createSessionFromPipeline(jobId, 50);
        localStorage.setItem('al_session_id', session.session_id);
        saveSessionJobMapping(session.session_id, jobId);
        toast.success(t('processing.creatingSession'));
        router.push(`/adaptive-learning/subject/${session.session_id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.error(message);
      }
    },
    [router, t],
  );

  return {
    error,
    handleOpenSession,
    loading,
    sessions,
  };
};
