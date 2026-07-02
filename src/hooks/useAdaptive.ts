'use client';

import useSWR from 'swr';
import { getKnowledgeGraph, getMasteryMatrix } from '@/features/adaptive/lib/adaptive-api-methods';

export function useKnowledgeGraph(sessionId: string | undefined) {
  return useSWR(
    sessionId ? `/api/adaptive/session/${sessionId}/graph` : null,
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
    sessionId ? `/api/adaptive/session/${sessionId}/mastery-matrix` : null,
    () => {
      if (!sessionId) throw new Error('sessionId is required');
      return getMasteryMatrix(sessionId);
    },
    {
      revalidateOnFocus: false,
    },
  );
}
