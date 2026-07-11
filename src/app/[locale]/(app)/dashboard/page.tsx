import { redirect } from '@/i18n/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDashboardBootstrapData } from '@/lib/dashboard-factory';
import { DashboardPageShell } from '@/features/dashboard/components/DashboardPageShell';
import { ROUTES } from '@/shared/constants/routes';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, session] = await Promise.all([params, getServerSession(authOptions)]);

  if (!session?.user) {
    // callbackUrl is locale-unprefixed (matches ROUTES / next-intl hrefs).
    return redirect({
      href: {
        pathname: ROUTES.LOGIN,
        query: { callbackUrl: ROUTES.DASHBOARD },
      },
      locale,
    });
  }

  const userId = session.user.id;
  const bootstrapData = await getDashboardBootstrapData(userId);
  const userEmail = session.user.email ?? '';

  return (
    <DashboardPageShell
      locale={locale}
      userEmail={userEmail}
      session={session}
      stats={bootstrapData.stats}
      adaptiveSubjects={bootstrapData.adaptiveSubjects}
      inProgressQuizzes={bootstrapData.inProgressQuizzes}
      recentOwnedQuizzes={bootstrapData.recentOwnedQuizzes}
      recentPublicQuizzes={bootstrapData.recentPublicQuizzes}
    />
  );
}
