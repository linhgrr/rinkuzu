import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

export default function DraftNotFound() {
  const t = useTranslations('draft.notFound');
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-xl font-semibold text-neutral-900">{t('title')}</h1>
      <p className="mb-6 max-w-md text-sm text-neutral-600">{t('description')}</p>
      <Link
        href={ROUTES.DASHBOARD}
        className="rounded-full bg-brand-action-strong px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-action-strong-hover"
      >
        {t('backToDashboard')}
      </Link>
    </main>
  );
}
