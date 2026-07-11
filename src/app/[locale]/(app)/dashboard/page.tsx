import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/config';
import { getCurrentSession } from '@/lib/auth/session';
import { getDashboardBootstrapData } from '@/lib/dashboard-factory';
import { DashboardPageShell } from '@/features/dashboard/components/DashboardPageShell';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, session] = await Promise.all([params, getCurrentSession()]);

  if (!session?.user) {
    const loginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
    const callbackPath = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
    redirect(`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`);
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
