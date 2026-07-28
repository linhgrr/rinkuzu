import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

export default function LocaleNotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-trust">404</p>
      <h1 className="mb-3 text-2xl font-semibold text-neutral-900">Page not found</h1>
      <p className="mb-8 max-w-md text-sm text-neutral-600">
        The page you are looking for does not exist or is no longer available.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={ROUTES.HOME}
          className="rounded-full bg-brand-action px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-action-hover"
        >
          Home
        </Link>
        <Link
          href={ROUTES.EXPLORE}
          className="rounded-full border border-neutral-300 bg-white px-6 py-2.5 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
        >
          Explore quizzes
        </Link>
      </div>
    </main>
  );
}
