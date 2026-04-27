'use client';

import { useTranslations } from 'next-intl';
import {
  SessionHistoryEmptyState,
  SessionHistoryErrorState,
  SessionHistoryList,
  SessionHistoryLoadingState,
} from './SessionHistorySections';
import { useSessionHistoryState } from './hooks/use-session-history-state';

export default function SessionHistory() {
  const t = useTranslations('adaptiveLearning');
  const { error, handleOpenSession, loading, sessions } = useSessionHistoryState();

  if (loading) return <SessionHistoryLoadingState message={t('history.loading')} />;

  if (error) return <SessionHistoryErrorState message={t('history.loadError', { error })} />;

  if (sessions.length === 0) {
    return (
      <SessionHistoryEmptyState
        hint={t('history.sessionSaveHint')}
        message={t('history.noSession')}
      />
    );
  }

  return <SessionHistoryList sessions={sessions} onOpen={handleOpenSession} />;
}

export { ExerciseHistoryTable } from './ExerciseHistoryTable';
