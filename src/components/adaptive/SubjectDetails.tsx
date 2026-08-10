'use client';

import { useTranslations } from 'next-intl';
import { useSubjectDetailsState } from '@/features/adaptive/hooks/use-subject-details-state';
import {
  SubjectDetailsBackButton,
  SubjectDetailsHero,
  SubjectDetailsTabContent,
  SubjectDetailsTabs,
} from './SubjectDetailsSections';

export default function SubjectDetails({ sessionId }: { sessionId: string }) {
  const t = useTranslations('adaptiveLearning');
  const {
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
  } = useSubjectDetailsState(sessionId, t);

  return (
    <div className="space-y-8 pb-12 font-home text-ink">
      <SubjectDetailsBackButton onClick={handleBackToDashboard} t={t} />

      <SubjectDetailsHero
        filename={filename}
        loading={loading}
        onPrefetchStartLearning={handlePrefetchStartLearning}
        onStartLearning={handleStartLearning}
        sessionNotice={sessionNotice}
        startingSession={startingSession}
        status={status}
        summary={summary}
        t={t}
      />

      <SubjectDetailsTabs activeTab={activeTab} onChange={setActiveTab} t={t} />

      <SubjectDetailsTabContent
        activeTab={activeTab}
        historyDetail={historyDetail}
        historyLoading={historyLoading}
        sessionId={sessionId}
        t={t}
      />
    </div>
  );
}
