'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { PipelinePartialGraph } from '@/features/adaptive/types/pipeline';
import { cn } from '@/lib/utils';
import styles from './ProcessingLayout.module.css';

// Shimmer only while the graph chunk is actually loading, and it fills the body
// instead of drawing a second card inside this one (RIN-1003).
const ProcessingGraphPanel = dynamic(() => import('./ProcessingGraphPanel'), {
  loading: () => <Skeleton className="size-full rounded-none" />,
  ssr: false,
});

export const ProcessingGraphCard = ({
  creatingSession,
  partialGraph,
  t,
}: {
  creatingSession: boolean;
  partialGraph: PipelinePartialGraph | null;
  t: TranslateFn;
}) => {
  const hasConcepts = (partialGraph?.nodes?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        styles['graphCard'],
        'hidden flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm lg:flex',
      )}
    >
      <div className="border-b border-line px-6 py-4">
        <h3 className="text-sm font-medium tracking-wide text-neutral-900">
          {t('processing.knowledgeGraph')}
        </h3>
        <p className="mt-0.5 text-xs text-neutral-500">{t('processing.graphDescription')}</p>
      </div>
      <div className="relative min-h-0 flex-1">
        {hasConcepts ? (
          <ProcessingGraphPanel partialGraph={partialGraph} />
        ) : (
          <p className="flex size-full items-center justify-center px-10 text-center text-sm text-neutral-500">
            {creatingSession ? t('processing.creatingSession') : t('processing.graphPlaceholder')}
          </p>
        )}
      </div>
    </div>
  );
};
