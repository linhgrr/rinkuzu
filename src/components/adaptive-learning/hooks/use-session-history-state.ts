'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSessionFromPipeline, getSubjectProgressHistory } from '../api-client';
import { saveSessionJobMapping } from '../session-storage';
import type { SessionHistoryItem } from '../types';

export const useSessionHistoryState = () => {
  const router = useRouter();
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
        if (mounted) setError(err instanceof Error ? err.message : String(err));
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
      const session = await createSessionFromPipeline(jobId, 50);
      localStorage.setItem('al_session_id', session.session_id);
      saveSessionJobMapping(session.session_id, jobId);
      router.push(`/adaptive-learning/subject/${session.session_id}`);
    },
    [router],
  );

  return {
    error,
    handleOpenSession,
    loading,
    sessions,
  };
};
