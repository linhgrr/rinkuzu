import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  HiOutlineArrowRight,
  HiOutlineDocumentText,
  HiOutlineSearch,
  HiOutlineSparkles,
} from '@/components/icons';

interface DashboardEmptyStateProps {
  locale: string;
  userName: string;
}

export async function DashboardEmptyState({ locale, userName }: DashboardEmptyStateProps) {
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-8 sm:p-12">
      <p className="text-sm font-medium text-brand-trust">
        {t('welcome', { name: userName })}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-neutral-900 sm:text-4xl">
        {t('emptyStateTitle')}
      </h1>
      <p className="mt-3 max-w-2xl text-base text-neutral-600">{t('emptyStateDescription')}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/create"
          className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 transition-[border-color,box-shadow] hover:border-brand-action hover:shadow-md"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-action text-white">
            <HiOutlineDocumentText className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {t('emptyStateCreateQuiz')}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">{t('emptyStateCreateQuizSub')}</p>
          </div>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-brand-action">
            {t('emptyStateCreateQuiz')}
            <HiOutlineArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          href="/adaptive-learning"
          className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 transition-[border-color,box-shadow] hover:border-brand-trust hover:shadow-md"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-trust text-white">
            <HiOutlineSparkles className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{t('emptyStateAdaptive')}</h2>
            <p className="mt-1 text-sm text-neutral-600">{t('emptyStateAdaptiveSub')}</p>
          </div>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-brand-trust">
            {t('emptyStateAdaptive')}
            <HiOutlineArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      <Link
        href="/explore"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-brand-trust"
      >
        <HiOutlineSearch className="size-4" />
        {t('emptyStateExplore')}
      </Link>
    </section>
  );
}
