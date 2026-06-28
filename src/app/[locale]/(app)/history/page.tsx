import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import ProfileHistory from '@/features/profile/components/ProfileHistory';
import { ProfilePageShell } from '@/features/profile/components/ProfilePageShell';
import { authOptions } from '@/lib/auth';
import { defaultLocale } from '@/i18n/config';
import { serviceFactory } from '@/lib/serviceFactory';

const HISTORY_PAGE_LIMIT = 10;

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, session] = await Promise.all([params, getServerSession(authOptions)]);

  if (!session?.user?.email) {
    const loginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
    const callbackPath = locale === defaultLocale ? '/history' : `/${locale}/history`;
    redirect(`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  const initialData = await serviceFactory
    .getUserService()
    .getUserAttempts(session.user.email, { page: 1, limit: HISTORY_PAGE_LIMIT });

  return (
    <ProfilePageShell>
      <ProfileHistory
        initialData={{
          attempts: initialData.attempts.map((attempt) => ({
            ...attempt,
            _id: attempt._id ?? '',
            takenAt:
              attempt.takenAt instanceof Date ? attempt.takenAt.toISOString() : attempt.takenAt,
          })),
          pagination: initialData.pagination,
        }}
      />
    </ProfilePageShell>
  );
}
