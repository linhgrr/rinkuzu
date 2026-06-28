import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import ProfileSettings from '@/features/profile/components/ProfileSettings';
import { authOptions } from '@/lib/auth';
import { defaultLocale } from '@/i18n/config';
import { getUserProfileByEmail } from '@/lib/user/profile-server';

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, session] = await Promise.all([params, getServerSession(authOptions)]);

  if (!session?.user?.email) {
    const loginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
    const callbackPath = locale === defaultLocale ? '/profile' : `/${locale}/profile`;
    redirect(`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  const initialProfile = await getUserProfileByEmail(session.user.email);

  return (
    <div className="min-h-screen bg-surface-page pb-24 md:pb-8">
      <main className="px-4 pb-4 pt-6 sm:px-6 md:pt-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <ProfileSettings initialProfile={initialProfile} />
        </div>
      </main>
    </div>
  );
}
