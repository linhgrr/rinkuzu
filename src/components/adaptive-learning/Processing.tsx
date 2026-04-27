'use client';

import { useTranslations } from 'next-intl';
import { useProcessingState } from './hooks/use-processing-state';
import { ProcessingGraphCard, ProcessingStatusCard, ProcessingTipCard } from './ProcessingSections';

export default function AdaptiveLearningProcessing() {
  const t = useTranslations('adaptiveLearning');
  const {
    creatingSession,
    currentStep,
    error,
    filename,
    handleErrorAction,
    notice,
    partialGraph,
    progress,
    showGraphPanel,
    stats,
    statusLabel,
    steps,
  } = useProcessingState(t);

  return (
    <div className="mx-auto mt-8 flex w-full max-w-6xl flex-col items-stretch gap-8 pt-4 lg:flex-row">
      <div className="w-full flex-shrink-0 lg:w-[45%]">
        <ProcessingStatusCard
          creatingSession={creatingSession}
          currentStep={currentStep}
          error={error}
          filename={filename}
          handleErrorAction={handleErrorAction}
          notice={notice}
          progress={progress}
          stats={stats}
          statusLabel={statusLabel}
          steps={steps}
          t={t}
        />

        {!error && <ProcessingTipCard t={t} />}
      </div>

      {!error && showGraphPanel && <ProcessingGraphCard partialGraph={partialGraph} t={t} />}
    </div>
  );
}
