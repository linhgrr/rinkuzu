'use client';

import { useRouter } from '@/i18n/navigation';
import { useCallback, useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AdaptiveApiError,
  isAdaptiveRequestAbortedError,
  isAdaptiveServiceUnavailableError,
} from '@/features/adaptive/lib/adaptive-api-error';
import {
  createSessionFromPipeline,
  getSubjectProgressHistory,
} from '@/features/adaptive/lib/adaptive-api-methods';
import { saveActiveSessionId, saveSessionJobMapping } from '../lib/session-storage';
import { toSessionHistoryViewModels } from '@/features/adaptive/mappers/session-history.mapper';
import type { SessionHistoryViewModel } from '@/features/adaptive/types/session-history-view-model';

interface SessionHistoryState {
  sessions: SessionHistoryViewModel[];
  loading: boolean;
  error: string | null;
}

type SessionHistoryAction =
  | { type: 'hydrateStart' }
  | { type: 'hydrateSuccess'; sessions: SessionHistoryViewModel[] }
  | { type: 'hydrateError'; error: string };

function sessionHistoryReducer(
  state: SessionHistoryState,
  action: SessionHistoryAction,
): SessionHistoryState {
  switch (action.type) {
    case 'hydrateStart':
      return { ...state, loading: true, error: null };
    case 'hydrateSuccess':
      return { ...state, sessions: action.sessions, loading: false };
    case 'hydrateError':
      return { ...state, error: action.error, loading: false };
    default:
      return state;
  }
}

export const useSessionHistoryState = () => {
  const router = useRouter();
  const t = useTranslations('adaptiveLearning');
  const [state, dispatch] = useReducer(sessionHistoryReducer, {
    sessions: [],
    loading: true,
    error: null,
  });

  const mapApiErrorToMessage = useCallback(
    (err: unknown) => {
      if (err instanceof AdaptiveApiError) {
        if (err.code === 'unauthorized') return t('processing.errors.unauthorized');
        if (isAdaptiveServiceUnavailableError(err))
          return t('processing.errors.serviceUnavailable');
        if (err.code === 'not_found') return t('subjectDetails.sessionMissing');
        if (err.code === 'conflict') return t('processing.errors.conflict');
        if (isAdaptiveRequestAbortedError(err)) return t('processing.errors.connectionInterrupted');
      }
      return t('processing.errors.generic');
    },
    [t],
  );

  useEffect(() => {
    let mounted = true;
    dispatch({ type: 'hydrateStart' });

    getSubjectProgressHistory(30)
      .then((data) => {
        if (mounted) {
          dispatch({ type: 'hydrateSuccess', sessions: toSessionHistoryViewModels(data) });
        }
      })
      .catch((err) => {
        if (mounted) {
          const message = mapApiErrorToMessage(err);
          dispatch({ type: 'hydrateError', error: message });
          toast.error(message);
        }
      });

    return () => {
      mounted = false;
    };
  }, [mapApiErrorToMessage]);

  const handleOpenSession = useCallback(
    async (jobId: string) => {
      try {
        const session = await createSessionFromPipeline(jobId, 50);
        saveActiveSessionId(session.session_id);
        saveSessionJobMapping(session.session_id, jobId);
        toast.success(t('processing.creatingSession'));
        router.push(`/adaptive/subject/${session.session_id}`);
      } catch (err) {
        const message = mapApiErrorToMessage(err);
        dispatch({ type: 'hydrateError', error: message });
        toast.error(message);
      }
    },
    [mapApiErrorToMessage, router, t],
  );

  const { error, loading, sessions } = state;

  return {
    error,
    handleOpenSession,
    loading,
    sessions,
  };
};
