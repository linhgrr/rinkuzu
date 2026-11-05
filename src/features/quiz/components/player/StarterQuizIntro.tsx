'use client';

import { useTranslations } from 'next-intl';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { markStarterQuizSkipped } from '@/features/quiz/lib/starter-skip';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

/** One-line intro with Skip above the starter quiz opened right after sign-in (RIN-913). */
export function StarterQuizIntro({ quizSlug }: { quizSlug: string }) {
  const t = useTranslations('quiz');

  return (
    <SurfaceCard
      aria-label={t('starterIntroLabel')}
      className="flex flex-wrap items-center justify-between gap-x-4 px-4 py-1 text-sm text-neutral-600"
    >
      <p className="py-2">{t('starterIntro')}</p>
      <Link
        href={ROUTES.DASHBOARD}
        onClick={() => markStarterQuizSkipped(quizSlug)}
        className="inline-flex min-h-11 items-center font-medium text-brand-trust underline-offset-4 hover:underline"
      >
        {t('starterSkip')}
      </Link>
    </SurfaceCard>
  );
}
