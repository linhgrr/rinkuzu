'use client';

import { useTranslations } from 'next-intl';
import { HiOutlineLockClosed, HiOutlineSparkles } from 'react-icons/hi';
import { Skeleton } from '@/components/ui/Skeleton';
import type { PremiumCatalogItemViewModel } from '@/features/quiz/api/premium-quiz-api';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

export function PremiumCatalogCard({ item }: { item: PremiumCatalogItemViewModel }) {
  const t = useTranslations('premium');

  return (
    <article className="group relative flex min-h-40 flex-col rounded-xl border border-accent/25 bg-accent-soft/45 p-4 shadow-quiz-card transition-shadow duration-150 ease-out hover:shadow-quiz-card-active focus-within:shadow-quiz-card-active motion-reduce:transition-none">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 font-semibold text-accent">
          <HiOutlineSparkles className="size-4" aria-hidden="true" />
          {t('catalogBadge')}
        </span>
        <span className="text-ink-muted">
          {t('catalogQuestionCount', { count: item.questionCount })}
        </span>
      </div>

      <Link
        href={ROUTES.QUIZ.VIEW(item.slug)}
        className="mt-3 flex flex-1 flex-col rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <h3 className="line-clamp-2 font-home text-body font-semibold text-ink">{item.title}</h3>
        {item.description ? (
          <p className="mt-2 line-clamp-2 font-home text-sm text-ink-muted">{item.description}</p>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 font-home text-sm font-medium text-ink">
          <HiOutlineLockClosed className="size-4 text-accent" aria-hidden="true" />
          {t('catalogAccessHint')}
        </span>
      </Link>
    </article>
  );
}

export function PremiumCatalogCardSkeleton() {
  return (
    <Skeleton className="flex min-h-40 flex-col rounded-xl border border-accent/20 bg-accent-soft/30 p-4 shadow-quiz-card">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 rounded-full bg-line-blue/30" />
        <div className="h-4 w-16 rounded bg-line-blue/25" />
      </div>
      <div className="mt-4 h-5 w-4/5 rounded bg-line-blue/30" />
      <div className="mt-2 h-4 w-full rounded bg-line-blue/20" />
      <div className="mt-auto h-4 w-36 rounded bg-line-blue/25" />
    </Skeleton>
  );
}
