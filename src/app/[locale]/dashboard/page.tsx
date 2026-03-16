import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { defaultLocale } from '@/i18n/config';
import { DashboardClient } from '../_components/DashboardClient';
import { getDashboardBootstrapData } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    const loginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
    const callbackPath = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
    redirect(`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  const userId = session.user.id;
  const userRole = session.user.role;
  const bootstrapData = await getDashboardBootstrapData(userId, userRole);

  const userEmail = session.user.email || '';

  return (
    <DashboardClient
      userEmail={userEmail}
      initialSession={session}
      initialStats={bootstrapData.stats}
      initialQuizzes={bootstrapData.quizzes}
      initialYourQuizzes={bootstrapData.yourQuizzes}
    />
  );
}
