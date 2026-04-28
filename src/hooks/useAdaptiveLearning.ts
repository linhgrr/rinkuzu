'use client';

import useSWR from 'swr';
import {
  getKnowledgeGraph,
  getMasteryMatrix,
  getConceptDetail,
} from '@/features/adaptive-learning/lib/api-client';

export function useKnowledgeGraph(sessionId: string | undefined) {
  return useSWR(
    sessionId ? `/api/adaptive-learning/session/${sessionId}/graph` : null,
    () => getKnowledgeGraph(sessionId!),
    {
      revalidateOnFocus: false,
      // SWR caches based on the key
    },
  );
}

export function useMasteryMatrix(sessionId: string | undefined) {
  return useSWR(
    sessionId ? `/api/adaptive-learning/session/${sessionId}/mastery-matrix` : null,
    () => getMasteryMatrix(sessionId!),
    {
      revalidateOnFocus: false,
    },
  );
}

export function useConceptDetail(sessionId: string | undefined, conceptId: string | undefined) {
  return useSWR(
    sessionId && conceptId
      ? `/api/adaptive-learning/session/${sessionId}/concept/${conceptId}`
      : null,
    () => getConceptDetail(sessionId!, conceptId!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // cache for 5 minutes
    },
  );
}
