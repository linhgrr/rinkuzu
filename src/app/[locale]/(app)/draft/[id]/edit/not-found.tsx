import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

export default function DraftNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-xl font-semibold text-neutral-900">Draft not found</h1>
      <p className="mb-6 max-w-md text-sm text-neutral-600">
        This draft may have expired, been published, or you may not have access to it.
      </p>
      <Link
        href={ROUTES.DASHBOARD}
        className="rounded-full bg-brand-action px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-action-hover"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
