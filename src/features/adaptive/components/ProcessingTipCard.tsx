'use client';

import { HiOutlineSparkles } from 'react-icons/hi';
import type { TranslateFn } from '@/features/adaptive/types/learning';

export const ProcessingTipCard = ({ t }: { t: TranslateFn }) => (
  <div className="mx-auto mt-6 flex w-full items-start gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-xs text-neutral-600 shadow-sm">
    <HiOutlineSparkles className="size-4 flex-shrink-0 text-neutral-400" />
    <p>
      <strong className="text-neutral-900">{t('processing.didYouKnow')}</strong>{' '}
      {t('processing.didYouKnowDescription')}
    </p>
  </div>
);
