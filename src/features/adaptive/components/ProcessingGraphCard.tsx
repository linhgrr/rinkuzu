'use client';

import dynamic from 'next/dynamic';
import { PanelBlockSkeleton } from '@/components/ui/PageLoadingSkeletons';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { PipelinePartialGraph } from '@/features/adaptive/types/pipeline';
import { cn } from '@/lib/utils';
import styles from './ProcessingLayout.module.css';

const ProcessingGraphPanel = dynamic(() => import('./ProcessingGraphPanel'), {
  loading: () => <PanelBlockSkeleton label="Loading processing graph" />,
  ssr: false,
});

export const ProcessingGraphCard = ({
  partialGraph,
  t,
}: {
  partialGraph: PipelinePartialGraph | null;
  t: TranslateFn;
}) => (
  <div
    className={cn(
      styles['graphCard'],
      'relative hidden overflow-hidden rounded-xl border border-line bg-white shadow-sm lg:flex',
    )}
  >
    <div className="pointer-events-none absolute left-6 top-6 z-10">
      <h3 className="text-sm font-medium tracking-wide text-neutral-900">
        {t('processing.knowledgeGraph')}
      </h3>
      <p className="mt-0.5 text-xs text-neutral-500">{t('processing.visualizingStructures')}</p>
    </div>
    <ProcessingGraphPanel partialGraph={partialGraph} />
  </div>
);
