'use client';

import { useTranslations } from 'next-intl';
import { useProcessingState } from '@/features/adaptive/hooks/use-processing-state';
import { ProcessingGraphCard } from './ProcessingGraphCard';
import { ProcessingStatusCard } from './ProcessingSections';
import { ProcessingTipCard } from './ProcessingTipCard';
import styles from './ProcessingLayout.module.css';

export default function AdaptiveLearningProcessing() {
  const t = useTranslations('adaptiveLearning');
  const {
    canRetry,
    creatingSession,
    currentStep,
    error,
    failedStep,
    filename,
    handleBackToLibrary,
    handleGoBack,
    handleRetry,
    notice,
    partialGraph,
    progress,
    retrying,
    showGraphPanel,
    stats,
    statusLabel,
    steps,
  } = useProcessingState(t);

  return (
    <div className="mx-auto mt-8 flex w-full max-w-6xl flex-col items-stretch gap-8 pt-4 lg:flex-row">
      <div className={`${styles['statusColumn']} flex-shrink-0`}>
        <ProcessingStatusCard
          canRetry={canRetry}
          creatingSession={creatingSession}
          currentStep={currentStep}
          error={error}
          failedStep={failedStep}
          filename={filename}
          notice={notice}
          onBackToLibrary={handleBackToLibrary}
          onRetry={() => void handleRetry()}
          onUploadAgain={handleGoBack}
          retrying={retrying}
          progress={progress}
          stats={stats}
          statusLabel={statusLabel}
          steps={steps}
          t={t}
        />

        {!error && <ProcessingTipCard t={t} />}
      </div>

      {!error && showGraphPanel && (
        <ProcessingGraphCard
          creatingSession={creatingSession}
          partialGraph={partialGraph ?? null}
          t={t}
        />
      )}
    </div>
  );
}
