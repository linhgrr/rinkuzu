'use client';

import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/Spinner';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { PipelinePartialGraph } from '@/features/adaptive/types/pipeline';

const ProcessingGraphPanel = dynamic(() => import('./ProcessingGraphPanel'), {
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
      </div>
    </div>
  ),
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
