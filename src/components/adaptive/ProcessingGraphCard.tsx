'use client';

import dynamic from 'next/dynamic';
import { PanelBlockSkeleton } from '@/components/ui/PageLoadingSkeletons';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { PipelinePartialGraph } from '@/features/adaptive/types/pipeline';

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
  <div className="relative hidden h-[600px] w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm lg:flex lg:w-[55%]">
    <div className="pointer-events-none absolute left-6 top-6 z-10">
      <h3 className="text-sm font-medium tracking-wide text-neutral-900">
        {t('processing.knowledgeGraph')}
      </h3>
      <p className="mt-0.5 text-xs text-neutral-500">{t('processing.visualizingStructures')}</p>
    </div>
    <ProcessingGraphPanel partialGraph={partialGraph} />
  </div>
);
