'use client';

import useSWR from 'swr';
import { getKnowledgeGraph, getMasteryMatrix } from '@/features/adaptive-learning/lib/api-client';

export function useKnowledgeGraph(sessionId: string | undefined) {
  return useSWR(
    sessionId ? `/api/adaptive-learning/session/${sessionId}/graph` : null,
    () => {
      if (!sessionId) throw new Error('sessionId is required');
      return getKnowledgeGraph(sessionId);
    },
    {
      revalidateOnFocus: false,
      // SWR caches based on the key
    },
  );
}

export function useMasteryMatrix(sessionId: string | undefined) {
  return useSWR(
    sessionId ? `/api/adaptive-learning/session/${sessionId}/mastery-matrix` : null,
    () => {
      if (!sessionId) throw new Error('sessionId is required');
      return getMasteryMatrix(sessionId);
    },
    {
      revalidateOnFocus: false,
    },
  );
}
