import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import ProfileQuizzes from '@/features/profile/components/ProfileQuizzes';
import { authOptions } from '@/lib/auth';
import { defaultLocale } from '@/i18n/config';
import { getQuizLibraryForUser } from '@/lib/quiz/library-server';

export default async function MyQuizzesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ locale }, { tab: rawTab }, session] = await Promise.all([
    params,
    searchParams,
    getServerSession(authOptions),
  ]);

  if (!session?.user) {
    const loginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
    const callbackPath = locale === defaultLocale ? '/my-quizzes' : `/${locale}/my-quizzes`;
    redirect(`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  const tab = rawTab === 'folders' ? 'folders' : 'quizzes';
  const initialLibrary =
    tab === 'quizzes'
      ? await getQuizLibraryForUser({ userId: session.user.id, limit: 100 })
      : { quizzes: [] };

  return <ProfileQuizzes tab={tab} initialQuizzes={initialLibrary.quizzes} />;
}
